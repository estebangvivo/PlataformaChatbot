import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { DESK_EVENT, EVENT_LABELS, weekRange } from "@/lib/desk-log";

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser();
  if (error) return error;

  try {
    const offset = Number(request.nextUrl.searchParams.get("week") ?? "0") || 0;
    const { start, end } = weekRange(offset);

    if (!prisma.deskEvent) {
      return NextResponse.json(
        { error: "Falta regenerar Prisma. Reiniciá el servidor (npx prisma generate)." },
        { status: 503 },
      );
    }

  const [events, newConversations, closedWeek, surveyedWeek] = await Promise.all([
    prisma.deskEvent.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: {
        actor: { select: { id: true, fullName: true } },
        fromAgent: { select: { id: true, fullName: true } },
        toAgent: { select: { id: true, fullName: true } },
        conversation: { select: { id: true, userName: true, whatsappPhone: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.conversation.count({
      where: { createdAt: { gte: start, lt: end } },
    }),
    prisma.conversation.findMany({
      where: { closedAt: { gte: start, lt: end } },
      select: {
        createdAt: true,
        assignedAt: true,
        firstBotReplyAt: true,
        firstHumanReplyAt: true,
        closedAt: true,
        channel: true,
        assignedAgentId: true,
      },
    }),
    prisma.conversation.findMany({
      where: { surveyedAt: { gte: start, lt: end }, surveyScore: { not: null } },
      select: {
        surveyScore: true,
        assignedAgentId: true,
        assignedAgent: { select: { fullName: true } },
      },
    }),
  ]);

  const count = (type: string) => events.filter((e) => e.type === type).length;

  const byAgent = new Map<
    string,
    {
      name: string;
      received: number;
      derived: number;
      resolved: number;
      unresolved: number;
      scores: number[];
    }
  >();

  function agentRow(id: string, name: string) {
    const current = byAgent.get(id) ?? {
      name,
      received: 0,
      derived: 0,
      resolved: 0,
      unresolved: 0,
      scores: [],
    };
    byAgent.set(id, current);
    return current;
  }

  for (const event of events) {
    if (event.type === DESK_EVENT.assigned || event.type === DESK_EVENT.takeover) {
      if (event.toAgent) agentRow(event.toAgent.id, event.toAgent.fullName).received += 1;
      if (event.actor && event.actor.id !== event.toAgentId) {
        agentRow(event.actor.id, event.actor.fullName).derived += 1;
      }
    }
    if (event.type === DESK_EVENT.closed_resolved && event.toAgent) {
      agentRow(event.toAgent.id, event.toAgent.fullName).resolved += 1;
    }
    if (event.type === DESK_EVENT.closed_unresolved && event.toAgent) {
      agentRow(event.toAgent.id, event.toAgent.fullName).unresolved += 1;
    }
  }

  for (const row of surveyedWeek) {
    if (row.assignedAgentId && row.assignedAgent && row.surveyScore != null) {
      agentRow(row.assignedAgentId, row.assignedAgent.fullName).scores.push(row.surveyScore);
    }
  }

  const byDepartment = new Map<string, number>();
  for (const event of events) {
    if (event.type !== DESK_EVENT.assigned && event.type !== DESK_EVENT.takeover) continue;
    const dept = event.department || "Sin área";
    byDepartment.set(dept, (byDepartment.get(dept) ?? 0) + 1);
  }

  const scores = surveyedWeek.map((s) => s.surveyScore).filter((n): n is number => n != null);
  const avg = (nums: number[]) => (nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null);
  const avgMs = (vals: number[]) => (vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
  const firstBotMs = closedWeek
    .filter((c) => c.firstBotReplyAt)
    .map((c) => c.firstBotReplyAt!.getTime() - c.createdAt.getTime());
  const pickupMs = closedWeek
    .filter((c) => c.assignedAt)
    .map((c) => c.assignedAt!.getTime() - c.createdAt.getTime());
  const handleMs = closedWeek
    .filter((c) => c.assignedAt && c.closedAt)
    .map((c) => c.closedAt!.getTime() - c.assignedAt!.getTime());

  const surveySent = count(DESK_EVENT.survey_sent);
  const surveyRated = count(DESK_EVENT.survey_rated);
  const surveySkipped = count(DESK_EVENT.survey_skipped);

  return NextResponse.json({
    weekOffset: offset,
    start: start.toISOString(),
    end: end.toISOString(),
    totals: {
      newConversations,
      assigned: count(DESK_EVENT.assigned),
      pending: count(DESK_EVENT.pending),
      takeover: count(DESK_EVENT.takeover),
      released: count(DESK_EVENT.released),
      resolved: count(DESK_EVENT.closed_resolved),
      unresolved: count(DESK_EVENT.closed_unresolved),
      reopened: count(DESK_EVENT.reopened),
      outOfScope: count(DESK_EVENT.out_of_scope),
      surveySent,
      surveyRated,
      surveySkipped,
      csat: avg(scores),
      surveyRate: surveySent ? Math.round((surveyRated / surveySent) * 100) : null,
      avgFirstBotMs: avgMs(firstBotMs),
      avgPickupMs: avgMs(pickupMs),
      avgHandleMs: avgMs(handleMs),
      closedWithHuman: closedWeek.filter((c) => c.assignedAt).length,
      closedBotOnly: closedWeek.filter((c) => !c.assignedAt).length,
    },
    byAgent: [...byAgent.values()]
      .map((row) => ({
        name: row.name,
        received: row.received,
        derived: row.derived,
        resolved: row.resolved,
        unresolved: row.unresolved,
        csat: avg(row.scores),
      }))
      .sort((a, b) => b.received + b.derived - (a.received + a.derived)),
    byDepartment: [...byDepartment.entries()].map(([department, count]) => ({ department, count })),
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      label: EVENT_LABELS[event.type] ?? event.type,
      createdAt: event.createdAt,
      actor: event.actor?.fullName ?? (event.source === "bot" ? "Bot" : "—"),
      fromAgent: event.fromAgent?.fullName ?? null,
      toAgent: event.toAgent?.fullName ?? null,
      department: event.department,
      intent: event.intent,
      outcome: event.outcome,
      note: event.note,
      source: event.source,
      contact: event.conversation.userName ?? event.conversation.whatsappPhone,
      conversationId: event.conversationId,
    })),
    });
  } catch (err) {
    console.error("[reports/weekly]", err);
    const message = err instanceof Error ? err.message : "No se pudo generar el informe";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

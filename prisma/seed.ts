import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const hours = JSON.stringify({
  days: [1, 2, 3, 4, 5],
  start: "08:00",
  end: "14:00",
});

const knowledge = [
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/",
    title: "Sede, horarios y contacto Regional 5",
    category: "General",
    contentChunk:
      "El Colegio de Arquitectos de la Provincia de Córdoba, Regional 5, atiende al público de lunes a viernes de 8 a 13 hs en San Juan 1553, Villa María, Córdoba. Teléfonos: 0353 453-5425 y 0353 452-9174. Emails: regional5@colegio-arquitectos.com.ar e info@regional5.com.ar. La atención de tramitación es sin turno, presencial, telefónica o por WhatsApp (texto o audio).",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/",
    title: "Subcentro Oncativo",
    category: "General",
    contentChunk:
      "Subcentro Oncativo: encargada y delegada Arq. Claudia Soria. Teléfono 353 500 8185. Email subcentror5-arqoncativo@hotmail.com. Atención online lunes a viernes de 10 a 12:30 hs. Presencial: coordinar telefónicamente.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/",
    title: "Subcentro Río Segundo / Pilar",
    category: "General",
    contentChunk:
      "Subcentro Río Segundo / Pilar: encargada Arq. Marina Sanchez. Teléfono 353 5106136. Email subsedepilarq@gmail.com. Atención online por WhatsApp y telefónica. Presencial: coordinar telefónicamente.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/",
    title: "Subcentro Canals",
    category: "General",
    contentChunk:
      "Subcentro Canals: encargada Arq. Lucrecia Mannino, delegada Arq. Tatiana Ligorria. Dirección Ing. Firpo n°242. Teléfono 353 5197832. Email subcentrocanals@gmail.com. Atención online lunes a viernes de 10 a 12 hs. Presencial martes y jueves de 10 a 12 hs.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/",
    title: "Subcentro Bell Ville",
    category: "General",
    contentChunk:
      "Subcentro Bell Ville: encargada Arq. Lucia Nobrega, delegado Arq. Juan Cane. Dirección Hipólito Irigoyen n° 338, Edificio Cerbell 1° piso. Teléfono 03537 412667 y WhatsApp 353 500 8147. Email arquitectosbellville@gmail.com. Atención online lunes a viernes 10 a 12 hs. Presencial lunes y viernes 10 a 12 hs.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/",
    title: "Subcentro Marcos Juárez",
    category: "General",
    contentChunk:
      "Subcentro Marcos Juárez: encargada Arq. Daniela Muñoz, delegado Arq. Daniel Sberna. Dirección Francisco Beiró N° 183 Local 2. Teléfono 353 5007242. Email subcentromj.r5@gmail.com. Atención online lunes a viernes 10 a 12 hs. Presencial lunes y jueves 10 a 12 hs.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/institucion/",
    title: "Autoridades de la Regional 5",
    category: "Institución",
    contentChunk:
      "Autoridades de Regional 5: Presidente Arq. Bonadero, Gustavo Eduardo (Villa Nueva). Secretario Arq. Cabrera, Candela (Villa María). Tesorero Arq. Casas, Marcela Susana (Villa María). Vocales titulares: Arq. Guzman Mauricio, Piazza Jimena, Teobaldi Santiago, Bettiol Milagros y Lopez Carlos. Comisión revisora de cuentas: Arq. Fernandez Boo Virginia, Marco Horacio y Zanini Gisela.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/institucion/",
    title: "Alcance territorial de Regional 5",
    category: "Institución",
    contentChunk:
      "La Regional 5 nuclea localidades del interior de Córdoba, entre ellas Villa María, Villa Nueva, Bell Ville, Oncativo, Marcos Juárez, Canals, Río Segundo, Pilar, Oliva, Leones, Corral de Bustos, Monte Maíz y más de 100 localidades del listado institucional publicado en regional5.com.ar/colegio-arquitectos/institucion/.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/asesorias/",
    title: "Asesorías gratuitas para matriculados",
    category: "Consultas Generales y Ejercicio Profesional",
    contentChunk:
      "Las asesorías son un servicio gratuito para arquitectos de la Regional. Se pueden hacer presenciales en sede o remotas (dejan datos y el asesor llama), ambas con turno previo, salvo tramitación general. Asesoría en Patrimonio: martes 11 a 12 hs, Arq. Valentina Guzmán. Asesoría Legal: martes 12 a 13 hs, Dr. Bucchioni Juan. Asesoría de Obra: miércoles 11:30 a 13 hs, Arq. Teobaldi Jorge. Asesoría Caja de Previsión: miércoles 11:30 a 13 hs, Arq. Teobaldi Guillermo. Asesoría Gas: jueves 12 a 13 hs, Arq. Colinas Alejandra y Arq. Martinotti Gustavo. Asesoría Contable: viernes 12 a 13 hs, Cr. Augusto Boero. Asesoría de tramitación del Colegio: lunes a viernes 8 a 13 hs, sin turno, presencial, telefónica o WhatsApp.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/medios-de-pago/",
    title: "Habilitación anual de matrícula",
    category: "Tesorería",
    contentChunk:
      "La habilitación anual tiene un primer cuerpo de pago obligatorio que vence el 10 de marzo de cada año e incluye el seguro de responsabilidad civil y bono por fallecimiento. El segundo cuerpo se abona solo si se presenta expediente. Para saber deuda o acreditar pago: Autogestión > Impresión de boletas > Habilitación de matrícula. El pago online se acredita en el día. Camino: Autogestión > Impresión de boletas > Habilitación de matrícula > Pagos TIC > seleccionar cuota > generar boleta > pagar.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/medios-de-pago/",
    title: "Medios de pago de aportes al Colegio",
    category: "Tesorería",
    contentChunk:
      "Los aportes al Colegio se pagan online desde Autogestión, opción Pago TIC. Hay que descargar las boletas (sirven para adjuntar al expediente, no para pagar). Luego generar boleta de pago. Opciones: PAGAR AHORA con tarjeta de crédito o débito (3 cuotas sin interés con Visa o Master, se puede delegar el pago); DESCARGAR CUPÓN para Rapipago, Pago Fácil o Mercado Pago; DEBIN con CBU o alias. No se recomienda usar el canal viejo de Pago Fácil fuera de Pago Tic.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/medios-de-pago/",
    title: "Aforo, timbrado o sellado de contratos",
    category: "Tesorería",
    contentChunk:
      "A partir del 1 de enero de 2023, por modificación del artículo 261 del Código Tributario Provincial, los contratos por locación de servicios profesionales no están alcanzados por el Impuesto de Sellos. Por disposición de la DGR de Córdoba, no se solicita el sellado/aforo de contrato por locación de servicios (tareas profesionales) para el registro de nuevos expedientes.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/tramitacion/",
    title: "Beneficio por registro: reintegro del 20% de aportes",
    category: "Tramitación",
    contentChunk:
      "La Junta de Gobierno del CAPC dio continuidad, del 1 de octubre de 2025 al 31 de marzo de 2026, al beneficio por registro: reintegro no reintegrable del 20% de los aportes al CAPC por registro de tareas profesionales y ROD de un expediente, con mínimo de $10.000 y tope de $550.000 para todas las tareas de un mismo expediente. Aplica a quienes pagaron aportes en esa vigencia al valor referencial de $589.000. El reintegro se hace por transferencia a la cuenta de la DDJJ en un plazo de 30 días, si el expediente fue liquidado y sellado por el departamento técnico.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/tramitacion/",
    title: "Actualización del valor básico del m2",
    category: "Tramitación",
    contentChunk:
      "El valor básico por m2 y las escalas arancelarias se actualizan dos veces al año, el 1 de abril y el 1 de octubre, por mecanismo automático (Acuerdo N°14 de la Mesa de la Construcción). Para fijar tasa a valores actuales hay que tener abonado el 100% de aportes a Colegio y Caja antes de la fecha de cambio de tasa. No es condición tener expediente digital iniciado o aprobado. Se pueden generar boletas desde Autogestión en la opción generación de boletas en base a cálculo.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/tramitacion/",
    title: "Certificado de baja de aportes u obra propia",
    category: "Tramitación",
    contentChunk:
      "El certificado de baja de aportes aplica solo a tareas de Conducción, Dirección o Representación Técnica, con expediente liquidado al 100% y trámite 100% online. Se descarga desde Autogestión > Expedientes registrados. Documentación del expediente digital: nota del arquitecto (reemplaza contrato), planilla de honorarios referenciales, plano municipal, escritura, DNI del cónyuge y libreta de familia si corresponde, DDJJ Anexo 1 y planilla de eximición Caja. Luego hay que pedir la eximición de aportes a la Caja (caja8470.com.ar). Para sellar hay que subir nota de eximición de Caja y boletas+tickets de arancel administrativo y fondo de salud.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/tramitacion/",
    title: "Firma digital remota",
    category: "Tramitación",
    contentChunk:
      "La tramitación de firma digital remota es sin costo. Las localidades y el trámite dependen del Gobierno de Córdoba, no del Colegio. Se gestiona turno en CiDi. Hay que asistir con DNI, celular con internet y la app OTP Authenticator instalada. Si se olvidan claves/PIN o se cambia de celular, hay que repetir el trámite. La Regional publica un tutorial de cómo firmar un documento.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/tramitacion/",
    title: "Certificado de arquitecto habilitado y expediente digital",
    category: "Matriculación",
    contentChunk:
      "El certificado de arquitecto habilitado se genera desde Autogestión > Menú CERTIFICADOS > Emitir. Para cargar comprobantes de pago en expediente digital hay que elegir el canal según el medio: Tarjeta o Banco Córdoba = BOLETA BANCOR; Pago Fácil o Mercado Pago = BOLETA PAGO FACIL; homebanking Link = BOLETAS PAGO LINK; Rapipago o Pay Per Tic = OTRO MEDIO DE PAGO; transferencia bancaria solo para Caja (el Colegio no acepta transferencia) = TRANSFERENCIA BANCARIA. Se adjunta boleta + ticket en un archivo o por separado, y el número debe coincidir.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/tramitacion/",
    title: "Renuncias, SIT y matriculación ECOGAS",
    category: "Tramitación",
    contentChunk:
      "Desde el 23 de abril de 2025 las renuncias bilaterales o unilaterales en Regional 5 no requieren pago de arancel administrativo ni fondo de salud. La documentación se envía a visadoresr5@colegio-arquitectos.com.ar o se presenta presencial. Formularios: Autogestión > Descargas > Proformas. El SIT permite información catastral de Córdoba; se accede con CiDi clave nivel 2 y herramienta CATASTRO. Si no se puede acceder, hay que enviar WhatsApp a la Regional con nombre completo y matrícula aclarando que es para alta en catastro. Desde el 1 de enero de 2026, instaladores matriculados de 1° categoría deben adjuntar credencial del Colegio y certificado de habilitación (ambos desde Autogestión, previo pago de 1° cuota de habilitación anual) para renovar matrícula en ECOGAS.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/servicios/",
    title: "Servicios para matriculados",
    category: "Servicios",
    contentChunk:
      "Servicios de Regional 5: préstamo de equipos especializados; convenios y descuentos; Arqui-emprendedor (desde 2017); registro Arqui-especialista; Fondo de Salud (fondo solidario originado en R5 y hoy provincial); seguro de responsabilidad civil profesional contratado por el Colegio (cubre mala praxis); credencial digital; Complejo Recreativo Parque Síquiman; matrícula M7 gratuita para arquitectos recién recibidos, con acceso a capacitaciones, servicios y beneficios; bolsa de trabajo gratuita del CAPC.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/concursos/",
    title: "Concursos y llamados",
    category: "Eventos",
    contentChunk:
      "En la sección Concursos de regional5.com.ar se publican los llamados vigentes e históricos, como el Concurso Provincial de Ideas vinculante para Café Laprida 40 (sede del Colegio), el Concurso Nacional de Ideas de arquitectura modular HábiKA, el Premio Obra Construida y concursos regionales de anteproyectos. Conviene revisar la web para bases y fechas actualizadas.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/tutoriales/",
    title: "Tutoriales para matriculados",
    category: "Tramitación",
    contentChunk:
      "La Regional publica tutoriales en video y PDF para agilizar trámites: cómo solicitar el reintegro del 20% de aportes por obras (subsidio), cómo firmar digitalmente un documento con firma digital remota, uso del Sistema de Información Territorial (SIT) y declaración de superficies en Catastro, y modalidad EPEC para factibilidades y trámites web. También se envían por mail y WhatsApp.",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/capacitacion/",
    title: "Capacitaciones y cursos Regional 5",
    category: "Capacitación",
    contentChunk:
      "Las capacitaciones y cursos de Regional 5 se publican en regional5.com.ar/colegio-arquitectos/capacitacion/ y se envían por mail y WhatsApp a los matriculados. Hay jornadas presenciales en sede y subcentros, con cupos limitados e inscripción previa. Ejemplo reciente: Capacitación en Perfilería y terminaciones ATRIM, presencial en Subcentro Oncativo (Rivadavia 743), 18 hs. Inscripción por formulario de Google. Para próximas fechas conviene mirar esa sección o preguntar por este chat el tema de interés (gas, catastro, firma digital, patrimonio, obra).",
  },
  {
    pageUrl: "https://regional5.com.ar/colegio-arquitectos/servicios/",
    title: "Matrícula M7 y capacitaciones para recién recibidos",
    category: "Capacitación",
    contentChunk:
      "La matrícula M7 es gratuita para arquitectos recientemente recibidos y permite acceso a las capacitaciones, servicios, beneficios e instalaciones del CAPC. La Regional también informa concursos, actividades y charlas en la web. Si alguien pregunta por cursos disponibles, orientar a la sección Capacitación y preguntar localidad y tema de interés.",
  },
];

async function main() {
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.knowledgeChunk.deleteMany();
  await prisma.routingRule.deleteMany();
  await prisma.agentProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.appSetting.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: "superadmin@regional5.local",
      passwordHash: await bcrypt.hash("Regional5Admin!", 10),
      role: "SUPERADMIN",
      fullName: "Super Admin R5",
      isOnline: true,
    },
  });

  const agents = [
    {
      email: "matriculacion@regional5.local",
      fullName: "Ana Matriculación",
      department: "Matriculación",
      keywords: ["matricula", "matrícula", "habilitacion", "m7", "ecogas", "credencial"],
    },
    {
      email: "tesoreria@regional5.local",
      fullName: "Marcos Tesorería",
      department: "Tesorería",
      keywords: ["pago", "boleta", "arancel", "deuda", "habilitacion anual", "tic"],
    },
    {
      email: "legales@regional5.local",
      fullName: "Laura Legales",
      department: "Legales",
      keywords: ["legal", "renuncia", "contrato", "asesoria legal", "bucchioni"],
    },
    {
      email: "tramites@regional5.local",
      fullName: "Julián Tramitación",
      department: "Tramitación",
      keywords: ["expediente", "firma digital", "sit", "catastro", "visado", "sellado"],
    },
    {
      email: "generales@regional5.local",
      fullName: "Sofía Consultas",
      department: "Consultas Generales y Ejercicio Profesional",
      keywords: ["horario", "direccion", "subcentro", "autoridad", "contacto"],
    },
  ];

  for (const agent of agents) {
    const user = await prisma.user.create({
      data: {
        email: agent.email,
        passwordHash: await bcrypt.hash("Agente123!", 10),
        role: "AGENT",
        fullName: agent.fullName,
        isOnline: true,
        agentProfile: {
          create: {
            department: agent.department,
            workHours: hours,
            assignedKeywords: JSON.stringify(agent.keywords),
          },
        },
      },
    });
    void user;
  }

  await prisma.routingRule.createMany({
    data: [
      {
        intent: "matriculacion",
        department: "Matriculación",
        keywords: JSON.stringify(["matricula", "matrícula", "habilitacion", "m7", "ecogas", "credencial digital"]),
        priority: 20,
      },
      {
        intent: "tesoreria",
        department: "Tesorería",
        keywords: JSON.stringify(["pago", "boleta", "arancel", "deuda", "rapipago", "debin", "cuota"]),
        priority: 20,
      },
      {
        intent: "legales",
        department: "Legales",
        keywords: JSON.stringify(["legal", "abogado", "renuncia", "contrato", "juicio", "asesoria legal"]),
        priority: 15,
      },
      {
        intent: "tramitacion",
        department: "Tramitación",
        keywords: JSON.stringify(["expediente", "firma digital", "sit", "catastro", "visado", "sellado", "reintegro"]),
        priority: 18,
      },
      {
        intent: "capacitacion",
        department: "Consultas Generales y Ejercicio Profesional",
        keywords: JSON.stringify(["curso", "cursos", "capacitacion", "capacitación", "taller", "charla", "formacion"]),
        priority: 16,
      },
      {
        intent: "general",
        department: "Consultas Generales y Ejercicio Profesional",
        keywords: JSON.stringify(["horario", "direccion", "subcentro", "autoridad", "asesoria", "contacto"]),
        priority: 5,
      },
      {
        intent: "asesoria_legal",
        department: "Asesoría Legal",
        keywords: JSON.stringify(["asesoria legal", "asesoría legal", "consulta legal"]),
        priority: 16,
      },
      {
        intent: "asesoria_tecnica",
        department: "Asesoría Técnica",
        keywords: JSON.stringify(["asesoria tecnica", "asesoría técnica", "asesoria de obra", "consulta tecnica"]),
        priority: 16,
      },
      {
        intent: "asesoria_gas",
        department: "Asesoría en Gas",
        keywords: JSON.stringify(["asesoria gas", "asesoría en gas", "ecogas", "instalador gas"]),
        priority: 16,
      },
      {
        intent: "caja_jubilacion",
        department: "Caja y Jubilación",
        keywords: JSON.stringify(["caja de prevision", "caja de previsión", "jubilacion", "jubilación", "aportes caja"]),
        priority: 16,
      },
      {
        intent: "visador",
        department: "Visador",
        keywords: JSON.stringify(["visador", "visado", "visadores", "expediente visado"]),
        priority: 17,
      },
    ],
  });

  await prisma.knowledgeChunk.createMany({ data: knowledge });

  await prisma.appSetting.createMany({
    data: [
      { key: "bot_name", value: "Asistente Regional 5" },
      { key: "welcome_message", value: "Hola, soy el asistente del Colegio de Arquitectos Regional 5. Puedo ayudarte con trámites, matrícula, pagos, asesorías y derivarte con un agente." },
      { key: "round_robin", value: "availability_then_oldest" },
    ],
  });

  const demo = await prisma.conversation.create({
    data: {
      whatsappPhone: "5493534000000",
      userName: "Arq. Demo Villa María",
      status: "BOT",
      messages: {
        create: [
          {
            senderType: "USER",
            content: "Hola, ¿cuál es el horario de atención de la Regional?",
          },
          {
            senderType: "BOT",
            content:
              "La sede de Regional 5 atiende de lunes a viernes de 8 a 13 hs en San Juan 1553, Villa María. Tel: 0353 453-5425. Si querés, también puedo derivarte con un agente.",
          },
        ],
      },
    },
  });

  console.log("Seed OK");
  console.log("SuperAdmin:", admin.email, "/ Regional5Admin!");
  console.log("Agentes: * @regional5.local / Agente123!");
  console.log("Conversación demo:", demo.whatsappPhone);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

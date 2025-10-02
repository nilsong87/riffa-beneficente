const {onRequest} = require("firebase-functions/v2/https");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

// Inicializa o app admin, permitindo que as funções acessem o Firestore
// com privilégios de administrador.
admin.initializeApp();

/**
 * Exemplo de Função HTTP: pode ser chamada por uma URL.
 * Responde com uma mensagem de boas-vindas.
 */
exports.helloWorld = onRequest((request, response) => {
  logger.info("A função helloWorld foi chamada!", {
    structuredData: true,
  });
  response.send("Olá do seu backend seguro no Firebase!");
});

/**
 * Cria o perfil de um usuário no Firestore após o cadastro.
 * A função é "chamável" (callable), o que significa que ela pode ser
 * chamada diretamente do código do site (script.js).
 */
exports.createUserProfile = onCall(async (request) => {
  // v2 onCall functions usam request.auth
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "Você precisa estar logado para criar um perfil.",
    );
  }

  // Os dados estão em request.data
  const {name, email, cpf, dob, phone, cep, address} = request.data;
  const uid = request.auth.uid;

  // TODO: Adicionar validação de dados do lado do servidor aqui.
  // Por exemplo: verificar se o formato do CPF é válido.

  // Salva os dados no Firestore usando os privilégios de administrador.
  try {
    await admin.firestore().collection("users").doc(uid).set({
      name: name,
      email: email,
      cpf: cpf,
      dob: dob,
      phone: phone,
      cep: cep,
      address: address,
      uid: uid,
    });
    logger.info(`Perfil criado para o usuário: ${uid}`);
    return {success: true, message: "Perfil criado com sucesso!"};
  } catch (error) {
    logger.error("Erro ao criar perfil:", error);
    // Lança um erro que pode ser pego no lado do cliente (no .catch).
    throw new HttpsError(
        "internal",
        "Não foi possível salvar o perfil no banco de dados.",
    );
  }
});

/**
 * Função Agendada: roda a cada 1 hora para liberar números pendentes.
 * Procura por números cujo status é 'pending' e cuja reserva expirou
 * (mais de 12 horas atrás) e os libera, voltando o status para 'available'.
 */
exports.releaseExpiredReservations = onSchedule("every 1 hours", async (event) => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  // Calcula o timestamp de 12 horas atrás
  const twelveHoursInMillis = 12 * 60 * 60 * 1000;
  const twelveHoursAgo = admin.firestore.Timestamp.fromMillis(
      now.toMillis() - twelveHoursInMillis,
  );

  // Busca todos os números pendentes que foram reservados antes de 12h atrás
  const query = db.collection("numbers")
      .where("status", "==", "pending")
      .where("reservedAt", "<=", twelveHoursAgo);

  const expiredReservations = await query.get();

  if (expiredReservations.empty) {
    logger.info("Nenhuma reserva expirada encontrada.");
    return null;
  }

  // Usa um batch para atualizar todos os documentos de uma vez
  const batch = db.batch();
  expiredReservations.forEach((doc) => {
    logger.info(`Liberando número: ${doc.id}`);
    batch.update(doc.ref, {
      status: "available",
      ownerId: null,
      ownerName: null,
      ownerEmail: null,
      reservedAt: null,
    });
  });

  await batch.commit();
  logger.info(
      `Liberação concluída. ${expiredReservations.size} números disponíveis.`,
  );
  return null;
});

/**
 * Recebe uma mensagem do formulário 'Fale Conosco' e a registra.
 */
exports.sendContactMessage = onCall(async (request) => {
  const {name, email, message} = request.data;

  // Validação simples dos dados
  if (!name || !email || !message) {
    throw new HttpsError(
        "invalid-argument",
        "Todos os campos são obrigatórios.",
    );
  }

  logger.info(`Nova mensagem de contato de ${name} (${email}): ${message}`);

  // TODO: Implementar o envio de e-mail real.
  // Para enviar e-mails a partir de uma Cloud Function, você precisará de um
  // serviço de terceiros, como SendGrid, Mailgun ou Resend.
  //
  // Exemplo usando Nodemailer com um serviço SMTP:
  // 1. Instale o Nodemailer: npm install nodemailer
  // 2. Configure o 'transporter' com as credenciais do seu provedor de e-mail.
  // 3. Use o transporter para enviar o e-mail.
  //
  // const nodemailer = require('nodemailer');
  // const transporter = nodemailer.createTransport({
  //   service: 'gmail', // ou outro serviço
  //   auth: {
  //     user: 'seu-email@gmail.com',
  //     pass: 'sua-senha-de-app' // Use senhas de app para o Gmail
  //   }
  // });
  //
  // await transporter.sendMail({
  //   from: `"${name}" <${email}>`,
  //   to: 'email-da-ong@example.com', // O e-mail da sua ONG
  //   subject: 'Nova Mensagem do Site',
  //   text: message,
  //   html: `<b>De:</b> ${name}<br><b>Email:</b> ${email}<br><b>Mensagem:</b><p>${message}</p>`
  // });

  return {success: true, message: "Mensagem enviada com sucesso!"};
});
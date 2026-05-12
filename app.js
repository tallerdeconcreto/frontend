const BACKEND_URL = "https://YOUR-BACKEND-URL.vercel.app/api/submit";

const form = document.getElementById("report-form");
const statusEl = document.getElementById("status");
const pdfPreview = document.getElementById("pdf-preview");

const setStatus = (message) => {
  statusEl.textContent = message;
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Falha ao ler imagem."));
    reader.readAsDataURL(file);
  });

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || "";
      resolve(result.toString().split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("Falha ao converter PDF."));
    reader.readAsDataURL(blob);
  });

const buildPdfHtml = (payload, imageData) => {
  const images = imageData
    .map((src) => `<img src="${src}" alt="Imagem enviada" />`)
    .join("");

  return `
    <h2>Relatorio enviado</h2>
    <div class="block"><strong>Nome:</strong> ${payload.name}</div>
    <div class="block"><strong>E-mail:</strong> ${payload.email || "Nao informado"}</div>
    <div class="block"><strong>Mensagem:</strong><br />${payload.message}</div>
    <div class="block">
      <strong>Imagens:</strong>
      <div class="images">${images || "Nenhuma imagem enviada."}</div>
    </div>
  `;
};

const generatePdfBlob = async () => {
  const worker = html2pdf().from(pdfPreview).toPdf();
  const pdf = await worker.get("pdf");
  return pdf.output("blob");
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Gerando PDF...");

  const formData = new FormData(form);
  const payload = {
    name: formData.get("name").toString().trim(),
    email: formData.get("email").toString().trim(),
    message: formData.get("message").toString().trim(),
  };

  const files = formData.getAll("images").filter((file) => file.size > 0);

  try {
    const imageData = await Promise.all(files.map(fileToDataUrl));
    pdfPreview.innerHTML = buildPdfHtml(payload, imageData);

    const pdfBlob = await generatePdfBlob();
    const pdfBase64 = await blobToBase64(pdfBlob);

    setStatus("Enviando para o Discord...");

    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        images: files.map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
        })),
        pdfBase64,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Falha ao enviar o PDF.");
    }

    setStatus("Enviado com sucesso.");
    form.reset();
  } catch (error) {
    setStatus(error.message);
  }
});

import env from "./env";

function getOrigin() {
  if (["test", "development"].includes(env.NODE_ENV)) {
    return `http://localhost:${env.PORTA}`;
  }

  if (process.env.NODE_ENV === "preview") {
    return `https://${env.VERCEL_URL}`;
  }

  return "https://api.fila-saude.com";
}

const webserver = {
  origin: getOrigin(),
};

export default webserver;

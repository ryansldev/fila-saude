import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { auth } from "infra/auth";

const signOutRoute: FastifyPluginAsyncZod = async (server) => {
  server.post("/", async (req, res) => {
    const response = await auth.api.signOut({
      headers: req.headers,
    });

    return res.status(200).send(response);
  });
};

export default signOutRoute;

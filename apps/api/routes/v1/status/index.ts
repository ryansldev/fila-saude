export default async function (fastify) {
  fastify.get('/', async () => {
    return { status: 'ok' };
  });
}
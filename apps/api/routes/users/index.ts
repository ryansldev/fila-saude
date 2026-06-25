export default async function (fastify, opts) {
  fastify.get('/', async () => {
    return { status: 'Root endpoint working' };
  });
}
import Fastify from 'fastify'

const fastify = Fastify({
  logger: true
})

fastify.get('/', async function handler () {
  return { hello: 'world' }
})

try {
  await fastify.listen({ port: 3333 })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
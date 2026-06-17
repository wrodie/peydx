import type { CollectionAfterChangeHook } from 'payload'
import { getIO } from '../websocket/io'

export const mediaAfterUpdate: CollectionAfterChangeHook = async (args) => {
  if (args.context?.preventSync) return
  const { doc, operation, req } = args
  if (operation === 'create') return

  const io = getIO()
  if (!io) return

  const programs = await req.payload.find({
    collection: 'programs',
    depth: 0,
    pagination: false,
    where: {
      or: [
        { 'slides.image': { equals: doc.id } },
        { 'slides.video': { equals: doc.id } },
      ],
    },
  })

  if (programs.docs.length === 0) return

  const deviceIds = new Set<number>()
  for (const program of programs.docs) {
    const schedules = await req.payload.find({
      collection: 'schedule',
      depth: 0,
      pagination: false,
      where: { program: { equals: program.id } },
    })

    for (const s of schedules.docs) {
      for (const dId of s.devices as number[]) {
        deviceIds.add(typeof dId === 'object' ? (dId as any).id : dId)
      }
    }

    if ((program as any).availableDevices) {
      for (const dId of (program as any).availableDevices) {
        deviceIds.add(typeof dId === 'object' ? dId.id : dId)
      }
    }
  }

  for (const deviceId of deviceIds) {
    io.to(`device:${deviceId}`).emit('schedule:update', {} as any)
  }

  if (deviceIds.size === 0) {
    const deptId = (doc as any)?.folder?.department
    if (deptId) {
      const deptIdNum = typeof deptId === 'object' ? deptId.id : deptId
      io.to(`department:${deptIdNum}`).emit('schedule:update', {} as any)
    }
  }
}

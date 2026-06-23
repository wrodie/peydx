import type { CollectionConfig } from 'payload'
import { getIO } from '../websocket/io'

export const Devices: CollectionConfig = {
  slug: 'devices',
  admin: {
    useAsTitle: 'name',
    group: 'Admin',
    hidden: ({ user }) => user?.role !== 'admin',
  },
  auth: {
    useAPIKey: true,
    disableLocalStrategy: true,
    strategies: [
      {
        name: 'browser-token',
        authenticate: async ({ headers, payload }) => {
          const token = headers.get('x-browser-token')
          if (!token) return { user: null }
          try {
            const device = await payload.find({
              collection: 'devices',
              where: { browserToken: { equals: token } },
              depth: 0,
              limit: 1,
              overrideAccess: true,
            })
            if (device.docs?.[0]?.deviceType === 'browser') {
              return { user: { ...device.docs[0], collection: 'devices' } }
            }
          } catch {}
          return { user: null }
        },
      },
    ],
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (data.controllingDevice) {
          const controller = await req.payload.findByID({
            collection: 'devices',
            id: data.controllingDevice,
            depth: 0,
          })
          if (controller.controllingDevice) {
            throw new Error('Cannot set a controlling device that is itself controlled by another device. Only one level of mirroring is allowed.')
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation }) => {
        if (operation !== 'update') return

        const io = getIO()
        if (!io) return

        const d = doc as any
        const p = previousDoc as any

        function id(v: any): number | undefined {
          if (v == null) return undefined
          return typeof v === 'object' ? Number(v.id) : Number(v)
        }
        function ids(arr: any[]): string {
          return (arr || []).map((v: any) => (typeof v === 'object' ? v.id : v)).sort((a: number, b: number) => a - b).join(',')
        }

        const changed = (
          d.hideProgramList !== p?.hideProgramList ||
          d.name !== p?.name ||
          d.deviceType !== p?.deviceType ||
          id(d.defaultBackground) !== id(p?.defaultBackground) ||
          ids(d.departments) !== ids(p?.departments)
        )
        if (!changed) return

        io.to(`device:${d.id}`).emit('schedule:update', {} as any)
      },
    ],
  },
  access: {
    read: ({ req: { user, query } }) => {
      if (!user) {
        if ((query as any)?.where?.browserToken?.equals) return true;
        return false;
      }
      if ((user as any).role === 'admin') return true;
      if ((user as any).collection === 'devices') return { id: { equals: user.id } } as any;
      const deptIds = ((user as any).departments || []).map((d: any) => typeof d === 'object' ? d.id : d);
      return { departments: { in: deptIds } } as any;
    },
    update: ({ req: { user } }) => {
      if (!user) return false;
      if ((user as any).role === 'admin') return true;
      if ((user as any).collection === 'devices') return { id: { equals: user.id } } as any;
      return false;
    },
    create: ({ req: { user } }) => (user as any)?.role === 'admin',
    delete: ({ req: { user } }) => (user as any)?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'deviceType',
      type: 'select',
      required: true,
      defaultValue: 'hardware',
      options: [
        { label: 'Hardware (sync agent)', value: 'hardware' },
        { label: 'Browser (direct URL)', value: 'browser' },
      ],
    },
    {
      name: 'departments',
      type: 'relationship',
      relationTo: 'departments',
      hasMany: true,
      required: true,
    },
    {
      name: 'controllingDevice',
      type: 'relationship',
      relationTo: 'devices',
      hasMany: false,
      admin: {
        description: "When set, this device mirrors the controlling device's program and slide position.",
      },
      filterOptions: ({ id }) => ({
        id: { not_equals: id },
      }),
    },
    {
      name: 'lastHeartbeat',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'currentProgram',
      type: 'relationship',
      relationTo: 'programs',
      admin: {
        readOnly: true,
        position: 'sidebar',
        condition: (data) => !!data.currentProgram,
      },
    },
    {
      name: 'currentSlideIndex',
      type: 'number',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Current slide index, reported by the device.',
      },
    },
    {
      name: 'clientVersion',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Version of the sync agent/player running on this device.',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'offline',
      options: [
        { label: 'Online', value: 'online' },
        { label: 'Offline', value: 'offline' },
        { label: 'Stale', value: 'stale' },
        { label: 'Updating', value: 'updating' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },

    {
      name: 'browserToken',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        condition: (data) => data.deviceType === 'browser',
      },
      hooks: {
        beforeValidate: [
          ({ value }) => {
            if (!value) {
              return crypto.randomUUID()
            }
            return value
          },
        ],
      },
    },
    {
      name: 'browserUrl',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '/components/CopyDeviceUrl#CopyDeviceUrl',
        },
        condition: (data) => data.deviceType === 'browser',
      },
    },
    {
      name: 'slideStatus',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '/components/DeviceSlideStatus#DeviceSlideStatus',
        },
      },
    },
    {
      name: 'defaultBackground',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Image shown centered on black when no program is running.',
      },
    },
    {
      name: 'hideProgramList',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'When enabled, the list of available programs is not shown on the device. It will only play auto-scheduled programs.',
      },
    },
  ],
}

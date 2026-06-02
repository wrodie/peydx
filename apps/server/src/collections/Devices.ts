import type { CollectionConfig } from 'payload'

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
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      if ((user as any).role === 'admin') return true;
      return { id: { equals: user.id } }
    },
    update: ({ req: { user } }) => {
      if (!user) return false;
      if ((user as any).role === 'admin') return true;
      return { departments: { contains: (user as any).department } };
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
      name: 'status',
      type: 'select',
      defaultValue: 'offline',
      options: [
        { label: 'Online', value: 'online' },
        { label: 'Offline', value: 'offline' },
        { label: 'Stale', value: 'stale' },
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
  ],
}

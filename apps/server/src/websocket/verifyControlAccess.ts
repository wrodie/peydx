function resolveDeptIds(departments: any[]): number[] {
  return (departments || []).map((d: any) =>
    typeof d === 'object' ? d.id : d
  )
}

function deptIdsOverlap(a: number[], b: number[]): boolean {
  return a.some((d) => b.includes(d))
}

export async function verifyControlAccess(
  socketData: any,
  deviceId: number,
  payload: any
): Promise<boolean> {
  const { type, role } = socketData

  // Device sockets are always allowed (they emit device:* events, not remote:*,
  // but preserve existing behavior)
  if (type === 'device') return true

  const deptIds = resolveDeptIds(socketData.departments)

  // Admin users can control any device
  if (type === 'user' && role === 'admin') return true

  // Non-admin user (manager/standard): department-scoped
  if (type === 'user') {
    if (deptIds.length === 0) return false
    // Fetch device with overrideAccess to bypass Payload ACL
    let device: any
    try {
      device = await payload.findByID({
        collection: 'devices',
        id: deviceId,
        depth: 0,
        overrideAccess: true,
      })
    } catch {
      return false
    }
    if (!device) return false
    const deviceDepts = resolveDeptIds(device.departments)
    return deptIdsOverlap(deptIds, deviceDepts)
  }

  // Integration: empty departments = global access; otherwise department-scoped
  if (type === 'integration') {
    if (deptIds.length === 0) return true
    let device: any
    try {
      device = await payload.findByID({
        collection: 'devices',
        id: deviceId,
        depth: 0,
        overrideAccess: true,
      })
    } catch {
      return false
    }
    if (!device) return false
    const deviceDepts = resolveDeptIds(device.departments)
    return deptIdsOverlap(deptIds, deviceDepts)
  }

  return false
}

export async function verifyProgramDepartmentAccess(
  socketData: any,
  programId: number,
  payload: any
): Promise<boolean> {
  const { type, role } = socketData

  // Admin users can load any program
  if (type === 'user' && role === 'admin') return true

  const deptIds = resolveDeptIds(socketData.departments)

  // Integration with empty departments = global access
  if (type === 'integration' && deptIds.length === 0) return true

  // Device sockets: allowed (preserve existing behavior)
  if (type === 'device') return true

  // Non-admin user or scoped integration: verify program department
  let program: any
  try {
    program = await payload.findByID({
      collection: 'programs',
      id: programId,
      depth: 1,
    })
  } catch {
    return false
  }
  if (!program) return false

  const deptCandidate = program.folder?.department
  const programDept = deptCandidate != null && typeof deptCandidate === 'object'
    ? deptCandidate.id
    : deptCandidate

  if (!programDept) return false
  return deptIds.includes(programDept)
}

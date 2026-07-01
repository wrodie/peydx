const TIMEZONE = process.env.TIMEZONE || 'UTC'

function todayDateStr(timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
}

function todayDayName(timeZone) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(new Date())
  return name.toLowerCase().slice(0, 3)
}

function filterActiveSchedule(items, timeZone, todayStr, dayName, now, graceHours) {
  const graceMs = (graceHours || 6) * 60 * 60 * 1000
  const grace = new Date(now.getTime() - graceMs)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  return items.filter(item => {
    if (!item.startTime) return false
    const daysOfWeek = item.daysOfWeek || []
    const isRecurring = daysOfWeek.length > 0
    const dateStr = todayStr || todayDateStr(timeZone)
    const day = dayName || todayDayName(timeZone)

    if (isRecurring) {
      if (!daysOfWeek.includes(day)) return false
    } else {
      const startDateInTZ = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(item.startTime))
      if (startDateInTZ !== dateStr) return false
    }

    if (item.untilDate && item.untilDate.slice(0, 10) < dateStr) return false

    const start = new Date(item.startTime)
    const end = item.endTime ? new Date(item.endTime) : null
    if (start > tomorrow) return false
    if (end && end < grace) return false
    if (!end && start < grace) return false
    return true
  })
}

function filterAvailability(programs, numericDeviceId, timeZone, todayStr) {
  const dateStr = todayStr || todayDateStr(timeZone)

  return programs
    .filter(program => {
      if (!program.availableFrom) return false
      const deviceIds = (program.availableDevices || []).map(d => typeof d === 'object' ? d.id : d)
      if (!deviceIds.includes(numericDeviceId)) return false
      const fromDate = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(program.availableFrom))
      if (fromDate > dateStr) return false
      if (program.availableUntil) {
        const untilDate = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(program.availableUntil))
        if (untilDate < dateStr) return false
      }
      return true
    })
    .map(program => ({
      startDate: program.availableFrom,
      endDate: program.availableUntil || null,
      program: program,
    }))
}

module.exports = {
  filterActiveSchedule,
  filterAvailability,
  todayDateStr,
  todayDayName,
}

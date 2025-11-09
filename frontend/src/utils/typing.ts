export function formatTypingUsers(rawNames: string[]): string {
  const uniqueNames = Array.from(
    new Set(
      rawNames
        .map((name) => name?.trim())
        .filter((name): name is string => Boolean(name && name.length > 0))
    )
  )

  if (uniqueNames.length === 0) {
    return ''
  }

  if (uniqueNames.length === 1) {
    return `${uniqueNames[0]} печатает...`
  }

  if (uniqueNames.length === 2) {
    return `${uniqueNames[0]} и ${uniqueNames[1]} печатают...`
  }

  const remaining = uniqueNames.length - 2
  return `${uniqueNames[0]}, ${uniqueNames[1]} и еще ${remaining} печатают...`
}


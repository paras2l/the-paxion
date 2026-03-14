type ApprovalTicket = {
  id: string
  actionId: string
  createdAt: number
  expiresAt: number
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export class ApprovalStore {
  private tickets = new Map<string, ApprovalTicket>()

  issue(actionId: string, ttlMs = 5 * 60 * 1000): ApprovalTicket {
    const createdAt = Date.now()
    const ticket: ApprovalTicket = {
      id: makeId(),
      actionId,
      createdAt,
      expiresAt: createdAt + ttlMs,
    }

    this.tickets.set(ticket.id, ticket)
    return ticket
  }

  consume(ticketId: string, actionId: string): boolean {
    const ticket = this.tickets.get(ticketId)
    if (!ticket) {
      return false
    }

    this.tickets.delete(ticketId)

    if (ticket.actionId !== actionId) {
      return false
    }

    return Date.now() <= ticket.expiresAt
  }
}

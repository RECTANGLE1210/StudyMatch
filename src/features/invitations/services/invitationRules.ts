export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'
export function assertInvitation(sender: string, recipient: string, blocked: boolean, active: boolean) {
  if (!sender || !recipient || sender === recipient) throw new Error('Cannot invite yourself')
  if (blocked) throw new Error('Blocked relationship')
  if (active) throw new Error('An active invitation already exists')
}
export function canChangeInvitation(status: InvitationStatus, next: InvitationStatus, actor: 'sender' | 'recipient') {
  return status === 'pending' && (actor === 'sender' ? next === 'cancelled' : next === 'accepted' || next === 'rejected')
}

import { useEffect, type RefObject } from 'react'
import type { Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from './events'
import type { PlayerControllerHandle } from './PlayerController'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export function useRemoteControl(
  socket: TypedSocket | null,
  controllerRef: RefObject<PlayerControllerHandle | null>,
) {
  useEffect(() => {
    if (!socket) return

    const onAdvance = () => controllerRef.current?.nextSlide()
    const onPrevious = () => controllerRef.current?.prevSlide()
    const onGoto = (data: { slideIndex: number }) => controllerRef.current?.gotoSlide(data.slideIndex)
    const onProgram = (data: { program: any; slideIndex: number }) => controllerRef.current?.selectProgram(data.program?.id)
    const onMenu = () => controllerRef.current?.openMenu()
    const onBack = () => controllerRef.current?.exitProgram()
    const onSelect = () => controllerRef.current?.selectItem()
    const onPause = () => controllerRef.current?.togglePause()

    socket.on('remote:advance', onAdvance)
    socket.on('remote:previous', onPrevious)
    socket.on('remote:goto', onGoto)
    socket.on('remote:program', onProgram)
    socket.on('remote:menu', onMenu)
    socket.on('remote:back', onBack)
    socket.on('remote:select', onSelect)
    socket.on('remote:pause', onPause)

    return () => {
      socket.off('remote:advance', onAdvance)
      socket.off('remote:previous', onPrevious)
      socket.off('remote:goto', onGoto)
      socket.off('remote:program', onProgram)
      socket.off('remote:menu', onMenu)
      socket.off('remote:back', onBack)
      socket.off('remote:select', onSelect)
      socket.off('remote:pause', onPause)
    }
  }, [socket, controllerRef])
}

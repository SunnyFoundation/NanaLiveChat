'use client'

import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from './utils/supabaseClient'
import ChatRoom from './components/ChatRoom'

interface User {
  id: string;
  created_at: string;
}

export default function Home() {
  const [myId, setMyId] = useState('')
  const [user1, setUser1] = useState<User | null>(null)
  const [user2, setUser2] = useState<User | null>(null)
  const [status, setStatus] = useState<'waiting' | 'matched' | 'ended'>('waiting')

  const myIdRef = useRef<string | null>(null)
  const channelRef = useRef<any>(null)
  const statusRef = useRef(status)
  statusRef.current = status

  useEffect(() => {
    if (!myIdRef.current) {
      const newId = uuidv4()
      myIdRef.current = newId
      setMyId(newId)
    }
  }, [])

  useEffect(() => {


    if (status === 'matched') {
      if (!user1 || !user2) return

      const currentUser1: User = user1;
      const currentUser2: User = user2;

      const chatRoomId = [currentUser1.id, currentUser2.id].sort().join('-')
      const leaveChannel = supabase.channel(`leave-${chatRoomId}`)

      leaveChannel.on('broadcast', { event: 'leave' }, (payload) => {
        if (payload.payload.leaverId !== myIdRef.current) {
          setStatus('ended')
        }
      })

      leaveChannel.subscribe()

      return () => {
        supabase.removeChannel(leaveChannel)
      }
    }

    if (status === 'waiting') {
      const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

      const handleMatchCheck = async () => {
        console.log('🔍 매칭 확인 중...')
        await delay(1500)

        const { data: users, error } = await supabase
          .from('waiting_users')
          .select('id, created_at')
          .order('created_at', { ascending: true })
          .limit(2)

        if (error) {
          console.error('❌ 사용자 조회 오류:', error)
          return
        }

        if (users?.length >= 2) {
          const [u1, u2] = users
          if (u1.id === myIdRef.current || u2.id === myIdRef.current) {
            console.log('🎯 매칭 성공:', u1.id, u2.id)
            setUser1(u1)
            setUser2(u2)
            setStatus('matched')

            if (channelRef.current) {
              await supabase.removeChannel(channelRef.current)
              channelRef.current = null
            }

            if (u1.id === myIdRef.current) {
              await supabase.from('waiting_users').delete().in('id', [u1.id, u2.id])
            }
          }
        }
      }

      const setup = async () => {
        if (!myIdRef.current) return
        await supabase.from('waiting_users').insert({ id: myIdRef.current })

        const waitingChannel = supabase.channel('waiting_users_changes').on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'waiting_users' },
          () => handleMatchCheck()
        )
        
        waitingChannel.subscribe()
        channelRef.current = waitingChannel

      }

      setup()

      return () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current)
        }
      }
    }
  }, [status, user1, user2])

  const handleLeave = async () => {
    if (!user1 || !user2) return
    const currentUser1: User = user1;
    const currentUser2: User = user2;
    const chatRoomId = [currentUser1.id, currentUser2.id].sort().join('-')
    const leaveChannel = supabase.channel(`leave-${chatRoomId}`)
    await leaveChannel.send({
      type: 'broadcast',
      event: 'leave',
      payload: { leaverId: myId },
    })
    setStatus('ended')
  }

  const handleFindNewChat = () => {
    setUser1(null)
    setUser2(null)
    setStatus('waiting')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="text-center py-1 bg-lime-500 text-white">
        <h1 className="text-5xl font-extrabold tracking-tight">나나라이브</h1>
        <p className="text-lg mt-2">www.nanalive.com</p>
      </header>

      <main className="flex-grow p-4 font-sans">
        <div className="max-w-4xl w-full bg-white rounded-xl shadow-md overflow-hidden p-6 mx-auto flex flex-col min-h-[80vh]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-indigo-600 mb-4">랜덤 채팅</h1>
            <p className="text-gray-500">
              상태:
              <span
                className={`font-semibold ml-2 ${
                  status === 'matched' ? 'text-green-500' : 'text-yellow-500'
                }`}
              >
                {status === 'matched'
                  ? '매칭 완료'
                  : status === 'ended'
                  ? '채팅 종료'
                  : '상대방 찾는 중...'}
              </span>
            </p>
            {/* <div className="mt-4 p-3 bg-gray-100 rounded-lg text-sm text-gray-700 break-all">
              <p>
                <span className="font-bold">나의 ID:</span> {myId}
              </p>
            </div> */}
          </div>

          <div className="mt-6">
            {status === 'matched' && user1 && user2 ? (
              <div>
                {/* <div className="p-3 bg-blue-100 rounded-lg text-sm text-blue-800 break-all mb-4">
                  <p>
                    <span className="font-bold">당신:</span>{' '}
                    {myId === user1.id ? user1.id : user2.id}
                  </p>
                  <p>
                    <span className="font-bold">낯선 상대:</span>{' '}
                    {myId === user1.id ? user2.id : user1.id}
                  </p>
                </div> */}
                <ChatRoom user1={user1} user2={user2} myId={myId} onLeave={handleLeave} />
              </div>
            ) : status === 'ended' ? (
              <div className="text-center py-10">
                <p className="text-red-500 font-semibold">채팅이 종료되었습니다.</p>
                <button
                  onClick={handleFindNewChat}
                  className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
                >
                  새로운 채팅 시작하기
                </button>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">상대방을 기다리고 있습니다.</p>
              </div>
            )}
          </div>
        </div>
        <img src="/손흥민.png" alt="손흥민" className="mt-8 mx-auto" />
      </main>

      <footer className="text-center py-4 bg-gray-800 text-gray-300 text-sm mt-8">
        <p>Copyright (c) 나나라이브</p>
        <p>운영 : 나나버니 , sunkim1055@gmail.com</p>
      </footer>
    </div>
  )
}

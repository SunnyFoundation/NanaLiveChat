'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../utils/supabaseClient'

// Define types for props and state
interface User {
  id: string;
  created_at: string;
}

interface Message {
  id: number;
  created_at: string;
  message: string;
  sender: string;
  receiver: string;
}

interface ChatRoomProps {
  user1: User;
  user2: User;
  myId: string;
  onLeave: () => void;
}

export default function ChatRoom({ user1, user2, myId, onLeave }: ChatRoomProps) {
  const [messageInput, setMessageInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const messagesEndRef = useRef<null | HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages]);

  useEffect(() => {
    if (!user1 || !user2) return

    setMessages([])

    // Set up a real-time subscription
    const channel = supabase
      .channel(`chat-room-${[user1.id, user2.id].sort().join('-')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message',
        },
        (payload) => {
          const newMessage = payload.new as Message
          // Check if the message belongs to this room and update state
          if (
            (newMessage.sender === user1.id && newMessage.receiver === user2.id) ||
            (newMessage.sender === user2.id && newMessage.receiver === user1.id)
          ) {
            setMessages((prevMessages) => [...prevMessages, newMessage])
          }
        }
      )
      .subscribe()

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user1, user2])

  const sendMessage = async () => {
    if (!messageInput.trim()) return

    const receiverId = myId === user1.id ? user2.id : user1.id

    const { error } = await supabase.from('message').insert({
      message: messageInput,
      sender: myId,
      receiver: receiverId,
    })

    if (error) {
      console.error("메시지 전송 에러:", error)
    } else {
      setMessageInput("")
    }
  }

  return (
    <div>
      <div 
        style={{ 
          marginTop: '1rem', 
          height: '500px', 
          maxHeight: '500px', 
          overflowY: 'auto', 
          border: '1px solid #eee', 
          padding: '1rem', 
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            style={{ 
              margin: '0.5rem 0', 
              listStyle: 'none', 
              paddingLeft: 0,
              alignSelf: msg.sender === myId ? 'flex-end' : 'flex-start',
              textAlign: msg.sender === myId ? 'right' : 'left'
            }}
          >
            <div style={{marginBottom: '0.25rem', fontSize: '0.8rem', color: '#666'}}>
              {msg.sender === myId ? '나' : '상대방'}
            </div>
            <div 
              style={{ 
                background: msg.sender === myId ? '#007bff' : '#e9ecef', 
                color: msg.sender === myId ? 'white' : 'black',
                padding: '0.5rem 1rem',
                borderRadius: '1rem'
              }}
            >
              {msg.message}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ marginTop: '1rem', display: 'flex' }}>
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="메시지를 입력하세요"
          style={{ 
            padding: '0.75rem', 
            flexGrow: 1, 
            border: '1px solid #ccc', 
            borderRadius: '8px' 
          }}
        />
        <button 
          onClick={sendMessage} 
          style={{ 
            marginLeft: '0.5rem', 
            padding: '0.75rem 1.5rem', 
            border: 'none',
            background: '#007bff',
            color: 'white',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          전송
        </button>
        <button 
          onClick={onLeave} 
          style={{ 
            marginLeft: '0.5rem', 
            padding: '0.75rem 1.5rem', 
            border: 'none',
            background: '#dc3545',
            color: 'white',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          나가기
        </button>
      </div>
    </div>
  )
}

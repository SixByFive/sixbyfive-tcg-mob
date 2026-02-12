// graphql/messages.js
import { gql } from "@apollo/client";

/* ============================================================================
   Inbox list (my chats)
   Used by: refreshChats()
============================================================================ */

export const QUERY_MY_CHATS = gql`
  query MyChats($limit: Int, $offset: Int) {
    myChats(limit: $limit, offset: $offset) {
      id
      unreadCount
      otherUser {
        id
        username
        avatar
      }
      lastMessage {
        id
        content
        createdAt
      }
      updatedAt
    }
  }
`;

/* ============================================================================
   Total unread count
   Used by: refreshUnread()
============================================================================ */

export const QUERY_UNREAD_COUNT = gql`
  query UnreadMessagesCount {
    unreadMessagesCount
  }
`;

/* ============================================================================
   Thread with a specific user
   Used by: fetchThread(otherUserId)
============================================================================ */

export const QUERY_CHAT_WITH_USER = gql`
  query ChatWithUser($otherUserId: ID!, $limit: Int, $before: String) {
    chatWithUser(otherUserId: $otherUserId) {
      id
      otherUser {
        id
        username
        avatar
      }
      messages(limit: $limit, before: $before) {
        id
        senderId
        receiverId
        content
        imageUrl
        createdAt
        status
      }
    }
  }
`;

/* ============================================================================
   Send message
============================================================================ */

export const MUTATION_SEND_MESSAGE = gql`
  mutation SendMessage($toUserId: ID!, $content: String, $imageUrl: String) {
    sendMessage(toUserId: $toUserId, content: $content, imageUrl: $imageUrl) {
      id
      senderId
      receiverId
      content
      imageUrl
      createdAt
      status
    }
  }
`;

/* ============================================================================
   Mark thread read (optional, but commonly needed)
============================================================================ */

export const MUTATION_MARK_THREAD_READ = gql`
  mutation MarkThreadRead($otherUserId: ID!) {
    markThreadRead(otherUserId: $otherUserId) {
      ok
    }
  }
`;

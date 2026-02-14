// graphql/messages.js

import { gql } from "@apollo/client";

/* =============================================================================
   Queries
============================================================================= */

export const QUERY_MY_CHATS = gql`
  query MyChats($page: Int, $pageSize: Int) {
    myChats(page: $page, pageSize: $pageSize) {
      user {
        id
        username
        avatar
        profile {
          avatar
        }
      }
      lastMessage {
        id
        senderId
        receiverId
        content
        isRead
        meta
        createdAt
      }
      unreadCount
    }
  }
`;

export const QUERY_CHAT_WITH_USER = gql`
  query ChatWithUser($userId: ID!, $page: Int, $pageSize: Int) {
    chatWithUser(userId: $userId, page: $page, pageSize: $pageSize) {
      id
      senderId
      receiverId
      content
      isRead
      meta
      isFlagged
      flagReason
      flaggedById
      isSystemMessage
      createdAt
      updatedAt
      expiresAt

      sender {
        id
        username
        avatar
        avatar
      }
      receiver {
        id
        username
        avatar
        avatar
      }
    }
  }
`;

export const QUERY_UNREAD_COUNT = gql`
  query UnreadCount {
    unreadCount
  }
`;

export const QUERY_HAS_AGREED_TO_CHAT_RULES = gql`
  query HasAgreedToChatRules {
    hasAgreedToChatRules
  }
`;

export const QUERY_CHAT_RULES_TEXT = gql`
  query ChatRulesText {
    chatRulesText
  }
`;

// Optional: if you ever need the compact rules version too
export const QUERY_CHAT_RULES = gql`
  query ChatRules {
    chatRules
  }
`;

/* =============================================================================
   Mutations
============================================================================= */

export const MUTATION_SEND_MESSAGE = gql`
  mutation SendMessage($receiverId: ID!, $content: String!, $meta: JSON) {
    sendMessage(receiverId: $receiverId, content: $content, meta: $meta) {
      id
      senderId
      receiverId
      content
      isRead
      meta
      createdAt
      updatedAt
    }
  }
`;

export const MUTATION_MARK_CHAT_READ = gql`
  mutation MarkChatRead($userId: ID!) {
    markChatRead(userId: $userId)
  }
`;

export const MUTATION_AGREE_TO_CHAT_RULES = gql`
  mutation AgreeToChatRules {
    agreeToChatRules
  }
`;

/* =============================================================================
   (Not used by your MessagingProvider currently, but used by your thread screen)
   You can keep these here too if you want them centralised:
============================================================================= */

export const MUTATION_REPORT_USER = gql`
  mutation ReportUser($userId: ID!, $reason: String!, $details: String) {
    reportUser(userId: $userId, reason: $reason, details: $details)
  }
`;

export const MUTATION_REPORT_MESSAGE = gql`
  mutation ReportMessage($messageId: ID!, $reason: String!, $details: String) {
    reportMessage(messageId: $messageId, reason: $reason, details: $details)
  }
`;

export const MUTATION_BLOCK_USER_FROM_CHAT = gql`
  mutation BlockUserFromChat($userId: ID!, $reason: String) {
    blockUserFromChat(userId: $userId, reason: $reason)
  }
`;

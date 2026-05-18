// graphql/messages.js — new backend schema

import { gql } from "@apollo/client";

export const QUERY_MY_CHATS = gql`
  query MyChats($page: Int, $pageSize: Int) {
    myChats(page: $page, pageSize: $pageSize) {
      user {
        id
        username
        avatar
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
      isSystemMessage
      meta
      createdAt
    }
  }
`;

export const QUERY_UNREAD_COUNT = gql`
  query UnreadCount {
    unreadMessageCount
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

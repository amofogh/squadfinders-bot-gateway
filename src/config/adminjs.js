import AdminJS from 'adminjs';
import * as AdminJSMongoose from '@adminjs/mongoose';
import { Player, Message, AdminUser } from '../models/index.js';
import { PrefilterResult } from '../models/index.js';
import { GamingGroup } from '../models/index.js';
import { UserSeen } from '../models/index.js';
import { CanceledUser, UserMessage } from '../models/index.js';
import { Reaction, UserAnalytics } from '../models/index.js';
import { componentLoader } from './componentLoader.js';
import { config } from './index.js';

// Register AdminJS Mongoose adapter
AdminJS.registerAdapter(AdminJSMongoose);

// Role-based access control
const isSuperAdmin = ({ currentAdmin }) => currentAdmin && currentAdmin.role === 'superadmin';
const isAdmin = ({ currentAdmin }) => currentAdmin && ['superadmin', 'admin'].includes(currentAdmin.role);

const DEFAULT_LIST_PER_PAGE = config.admin.listPerPage;

const ensureListRequestPerPage = (perPage, request = {}) => {
  const perPageValue = String(perPage);
  const query = request.query || {};

  if (!query.perPage) {
    return {
      ...request,
      query: {
        ...query,
        perPage: perPageValue,
      },
    };
  }

  return request;
};

const withDefaultListPerPage = (actions, perPage = DEFAULT_LIST_PER_PAGE) => {
  const listAction = actions?.list || {};
  const originalBefore = listAction.before;

  return {
    ...actions,
    list: {
      ...listAction,
      before: async (request, context) => {
        const requestWithPerPage = ensureListRequestPerPage(perPage, request);
        return originalBefore
          ? originalBefore(requestWithPerPage, context)
          : requestWithPerPage;
      },
    },
  };
};

const viewerRole = withDefaultListPerPage({
  new: { isAccessible: isSuperAdmin },
  edit: { isAccessible: isSuperAdmin },
  delete: { isAccessible: isSuperAdmin },
  bulkDelete: { isAccessible: isSuperAdmin },
  list: { isAccessible: true },
  show: { isAccessible: true },
});

const adminRole = withDefaultListPerPage({
  new: { isAccessible: isSuperAdmin },
  edit: { isAccessible: isSuperAdmin },
  delete: { isAccessible: isSuperAdmin },
  bulkDelete: { isAccessible: isSuperAdmin },
  list: { isAccessible: true },
  show: { isAccessible: true },
});

const superAdminRole = withDefaultListPerPage({
  new: { isAccessible: isSuperAdmin },
  edit: { isAccessible: isSuperAdmin },
  delete: { isAccessible: isSuperAdmin },
  bulkDelete: { isAccessible: isSuperAdmin },
  list: { isAccessible: isSuperAdmin },
  show: { isAccessible: isSuperAdmin },
});

export const adminJS = new AdminJS({
  componentLoader,
  dashboard: {
    component: componentLoader.add('Dashboard', '../components/Dashboard'),
    handler: async (request, response, context) => {
      // This ensures the dashboard component has access to the current admin
      return {
        currentAdmin: context.currentAdmin
      };
    }
  },
  pages: {
    'user-analytics': {
      label: 'User Analytics',
      icon: 'Activity',
      component: componentLoader.add('UserAnalyticsDashboard', '../components/UserAnalyticsDashboard'),
      handler: async (request, response, context) => ({
        currentAdmin: context.currentAdmin
      })
    }
  },
  resources: [
    {
      resource: Player,
      options: {
        list: {
          perPage: DEFAULT_LIST_PER_PAGE,
        },
        actions: viewerRole,
        navigation: {
          name: 'Game Data',
          icon: 'Users'
        },
        sort: {
          sortBy: 'createdAt',
          direction: 'desc'
        },
        listProperties: [
          'message_id',
          'message_date',
          'group.group_title',
          'sender.username',
          'message',
          'active'
        ],
        filterProperties: [
          'platform',
          'active',
          'sender.username',
          'group.group_username',
          'message_date',
          'game_mode',
          'players_count'
        ],
        showProperties: [
          'message_id',
          'message_date',
          'platform',
          'group.group_id',
          'group.group_title',
          'group.group_username',
          'sender.id',
          'sender.username',
          'sender.name',
          'rank',
          'active',
          'players_count',
          'game_mode',
          'message',
          'createdAt',
          'updatedAt'
        ]
      }
    },
    {
      resource: Message,
      options: {
        list: {
          perPage: DEFAULT_LIST_PER_PAGE,
        },
        actions: viewerRole,
        navigation: {
          name: 'Game Data',
          icon: 'MessageSquare'
        },
        sort: {
          sortBy: 'createdAt',
          direction: 'desc'
        },
        properties: {
          ai_status: {
            availableValues: [
              { value: 'pending', label: 'Pending' },
              { value: 'processing', label: 'Processing' },
              { value: 'completed', label: 'Completed' },
              { value: 'failed', label: 'Failed' },
              { value: 'expired', label: 'Expired' },
              { value: 'canceled_by_user', label: 'Canceled by User' },
            ],
          },
        },
        listProperties: [
          'message_id',
          'message_date',
          'group.group_title',
          'sender.username',
          'message',
          'is_valid',
          'is_lfg',
          'ai_status'
        ],
        filterProperties: [
          'message_id',
          'group.group_username',
          'sender.username',
          'message_date',
          'is_valid',
          'is_lfg',
          'ai_status',
        ],
        showProperties: [
          'message_id',
          'message_date',
          'group.group_id',
          'group.group_title',
          'group.group_username',
          'sender.id',
          'sender.username',
          'sender.name',
          'message',
          'is_valid',
          'is_lfg',
          'reason',
          'ai_status',
          'createdAt',
          'updatedAt'
        ]
      }
    },
    {
      resource: PrefilterResult,
      options: {
        list: {
          perPage: DEFAULT_LIST_PER_PAGE,
        },
        actions: viewerRole,
        navigation: {
          name: 'AI Results',
          icon: 'Filter'
        },
        sort: {
          sortBy: 'message_date',
          direction: 'desc'
        },
        listProperties: [
          'message_id',
          'message_date',
          'message',
          'maybe_lfg',
          'confidence'
        ],
        filterProperties: [
          'message_id',
          'message_date',
          'maybe_lfg',
          'confidence'
        ],
        showProperties: [
          'message_id',
          'message',
          'message_date',
          'maybe_lfg',
          'confidence',
          'createdAt',
          'updatedAt'
        ]
      }
    },
    {
      resource: GamingGroup,
      options: {
        list: {
          perPage: DEFAULT_LIST_PER_PAGE,
        },
        actions: adminRole,
        navigation: {
          name: 'Settings',
          icon: 'Users'
        },
        sort: {
          sortBy: 'name',
          direction: 'asc'
        },
        properties: {
          name: {
            description: 'You can add group username or link like IRANR6SGP OR t.me/+9pHPhzzBoc8wNTM8 OR t.me/IRANR6SGP'
          }
        },
        listProperties: [
          'name',
          'active',
          'createdAt',
          'updatedAt'
        ],
        filterProperties: [
          'name',
          'active'
        ],
        showProperties: [
          'name',
          'active',
          'createdAt',
          'updatedAt'
        ]
      }
    },
    {
      resource: UserSeen,
      options: {
        list: {
          perPage: DEFAULT_LIST_PER_PAGE,
        },
        actions: withDefaultListPerPage({
          new: { isAccessible: false },
          edit: { isAccessible: false },
          delete: { isAccessible: false },
          bulkDelete: { isAccessible: false },
          list: { isAccessible: true },
          show: { isAccessible: true },
        }),
        navigation: {
          name: 'User Engagement',
          icon: 'Eye'
        },
        sort: {
          sortBy: 'updatedAt',
          direction: 'desc'
        },
        listProperties: [
          'user_id',
          'username',
          'active',
          'updatedAt'
        ],
        filterProperties: [
          'user_id',
          'username',
          'active'
        ],
        showProperties: [
          'user_id',
          'username',
          'message_ids',
          'active',
          'createdAt',
          'updatedAt'
        ]
      }
    },
    {
      resource: CanceledUser,
      options: {
        list: {
          perPage: DEFAULT_LIST_PER_PAGE,
        },
        actions: adminRole,
        navigation: {
          name: 'User Engagement',
          icon: 'UserX'
        },
        sort: {
          sortBy: 'createdAt',
          direction: 'desc'
        },
        listProperties: [
          'user_id',
          'username',
          'createdAt',
          'updatedAt'
        ],
        filterProperties: [
          'user_id',
          'username'
        ],
        showProperties: [
          'user_id',
          'username',
          'createdAt',
          'updatedAt'
        ]
      }
    },
    {
      resource: UserMessage,
      options: {
        list: {
          perPage: DEFAULT_LIST_PER_PAGE,
        },
        actions: withDefaultListPerPage({
          new: { isAccessible: false },
          edit: { isAccessible: false },
          delete: { isAccessible: false },
          bulkDelete: { isAccessible: false },
          list: { isAccessible: true },
          show: { isAccessible: true },
        }),
        navigation: {
          name: 'User Engagement',
          icon: 'MessageCircle'
        },
        sort: {
          sortBy: 'message_date',
          direction: 'desc'
        },
        listProperties: [
          'user_id',
          'username',
          'message_date',
          'message'
        ],
        filterProperties: [
          'user_id',
          'username',
          'message_date'
        ],
        showProperties: [
          'user_id',
          'username',
          'message_date',
          'message',
          'createdAt',
          'updatedAt'
        ]
      }
    },
    {
      resource: Reaction,
      options: {
        list: {
          perPage: DEFAULT_LIST_PER_PAGE,
        },
        actions: withDefaultListPerPage({
          new: { isAccessible: false },
          edit: { isAccessible: false },
          delete: { isAccessible: isAdmin },
          bulkDelete: { isAccessible: isAdmin },
          list: { isAccessible: true },
          show: { isAccessible: true },
        }),
        navigation: {
          name: 'User Engagement',
          icon: 'Heart'
        },
        sort: {
          sortBy: 'message_date',
          direction: 'desc'
        },
        listProperties: [
          'user_id',
          'username',
          'chat_id',
          'message_id',
          'emoji',
          'type',
          'message_date'
        ],
        filterProperties: [
          'user_id',
          'username',
          'chat_id',
          'message_id',
          'emoji',
          'type',
          'message_date'
        ],
        showProperties: [
          'user_id',
          'username',
          'chat_id',
          'message_id',
          'emoji',
          'type',
          'message_date',
          'meta',
          'createdAt',
          'updatedAt'
        ]
      }
    },
    {
      resource: UserAnalytics,
      options: {
        list: {
          perPage: DEFAULT_LIST_PER_PAGE,
        },
        actions: withDefaultListPerPage({
          new: { isAccessible: false },
          edit: { isAccessible: isAdmin },
          delete: { isAccessible: isAdmin },
          bulkDelete: { isAccessible: isAdmin },
          list: { isAccessible: true },
          show: { isAccessible: true },
        }),
        navigation: {
          name: 'User Engagement',
          icon: 'BarChart'
        },
        sort: {
          sortBy: 'updatedAt',
          direction: 'desc'
        },
        listProperties: [
          'user_id',
          'username',
          'is_canceled',
          'messages.total',
          'reactions.total',
          'player.count',
          'dm.total_sent'
        ],
        filterProperties: [
          'user_id',
          'username',
          'is_canceled'
        ],
        showProperties: [
          'user_id',
          'username',
          'is_canceled',
          'last_canceled_at',
          'last_resumed_at',
          'dm',
          'messages',
          'reactions',
          'player',
          'seen',
          'status_history',
          'daily',
          'createdAt',
          'updatedAt'
        ]
      }
    },
    {
      resource: AdminUser,
      options: {
        list: {
            perPage: DEFAULT_LIST_PER_PAGE,
        },
        actions: withDefaultListPerPage({
          new: { isAccessible: isSuperAdmin },
          edit: {
            isAccessible: ({ currentAdmin, record }) => {
              if (!currentAdmin) return false;
              if (currentAdmin.role === 'superadmin') return true;
              if (currentAdmin.role === 'admin') {
                // Admin can edit viewer and admin roles, but not superadmin
                return record?.params?.role !== 'superadmin';
              }
              return false;
            }
          },
          delete: { isAccessible: isSuperAdmin },
          bulkDelete: { isAccessible: isSuperAdmin },
          list: { isAccessible: isAdmin },
          show: { isAccessible: isAdmin },
        }),
        navigation: {
          name: 'Administration',
          icon: 'Shield'
        },
        sort: {
          sortBy: 'createdAt',
          direction: 'desc'
        },
        properties: {
          role: {
            isVisible: {
              list: true,
              filter: true,
              show: true,
              edit: true
            },
            availableValues: [
              { value: 'superadmin', label: 'Super Admin' },
              { value: 'admin', label: 'Admin' },
              { value: 'viewer', label: 'Viewer' }
            ]
          },
          password: {
            isVisible: {
              list: false,
              show: false,
              edit: true,
              filter: false
            }
          }
        },
        actions: {
          ...superAdminRole,
          edit: {
            isAccessible: ({ currentAdmin, record }) => {
              if (!currentAdmin) return [];
              if (currentAdmin.role === 'superadmin') {
                return true;
              }
              if (currentAdmin.role === 'admin') {
                // Admin can edit viewer and admin roles, but not superadmin
                return record?.params?.role !== 'superadmin';
              }
              return false;
            },
            before: async (request, { currentAdmin }) => {
              // Prevent admins from setting role to superadmin
              if (currentAdmin?.role === 'admin' && request.payload?.role === 'superadmin') {
                throw new Error('Admins cannot assign superadmin role');
              }
              return request;
            }
          }
        }
      }
    }
  ],
  rootPath: '/admin',
  locale: {
    language: 'en',
    availableLanguages: ['en'],
    translations: {
      en: {
        labels: {
          Player: 'Player',
          players: 'Players',
          Message: 'Message',
          messages: 'Messages',
          AdminUser: 'Admin User',
          adminUsers: 'Admin Users',
          PrefilterResult: 'Prefilter Result',
          prefilterResults: 'Prefilter Results',
          GamingGroup: 'Gaming Group',
          gamingGroups: 'Gaming Groups',
          UserSeen: 'User Seen',
          userSeens: 'User Seen',
          CanceledUser: 'Canceled User',
          canceledUsers: 'Canceled Users',
          UserMessage: 'User Message',
          userMessages: 'User Messages',
          Reaction: 'Reaction',
          reactions: 'Reactions',
          UserAnalytics: 'User Analytics',
          userAnalytics: 'User Analytics'
        }
      }
    }
  },
  branding: {
    companyName: 'SquadFinders',
    logo: false,
    theme: {
      dark: true,
      colors: {
        primary100: '#6366f1',
        primary80: '#4f46e5',
        primary60: '#4338ca',
        primary40: '#312e81',
        primary20: '#1e1b4b',
        accent: '#a855f7',
        success: '#22c55e',
        info: '#38bdf8',
        danger: '#ef4444',
        warning: '#f97316',
        bg: '#020617',
        bg2: '#0f172a',
        layoutHeaderBg: '#020617',
        layoutHeaderText: '#e2e8f0',
        text: '#e2e8f0',
        textLight: '#cbd5f5',
        border: '#1f2937',
        hoverBg: '#1e293b'
      }
    }
  }
});
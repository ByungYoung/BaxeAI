import { createId } from '@paralleldrive/cuid2';
import { relations, sql } from 'drizzle-orm';
import { boolean, pgEnum, pgTable, real, timestamp, varchar } from 'drizzle-orm/pg-core';

// 기분 상태를 위한 enum 타입 정의
export const moodEnum = pgEnum('mood', ['happy', 'sad', 'stressed', 'relaxed', 'neutral']);

// User 테이블 정의
export const users = pgTable('User', {
  id: varchar('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => createId()),
  email: varchar('email').notNull().unique(),
  name: varchar('name'),
  company: varchar('company').notNull().default(''),
  password: varchar('password'),
  isAdmin: boolean('isAdmin').notNull().default(false),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// MeasurementResult 테이블 정의
export const measurementResults = pgTable('MeasurementResult', {
  id: varchar('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => createId()),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  heartRate: real('heartRate').notNull(),
  confidence: real('confidence').notNull(),
  temperature: real('temperature').notNull(), // 온도 측정 필드 추가 (null 불가)
  rmssd: real('rmssd'),
  sdnn: real('sdnn'),
  lf: real('lf'),
  hf: real('hf'),
  lfHfRatio: real('lfHfRatio'),
  pnn50: real('pnn50'),
  mood: varchar('mood'),
  caricatureUrl: varchar('caricatureUrl'), // 캐리커처 URL 필드 추가
  userId: varchar('userId')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  email: varchar('email').notNull(), // 이메일은 null 불가
});

// 관계 정의
export const usersRelations = relations(users, ({ many }) => ({
  measurementResults: many(measurementResults),
}));

export const measurementResultsRelations = relations(measurementResults, ({ one }) => ({
  user: one(users, {
    fields: [measurementResults.userId],
    references: [users.id],
  }),
}));

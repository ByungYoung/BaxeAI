CREATE TYPE "public"."mood" AS ENUM('happy', 'sad', 'stressed', 'relaxed', 'neutral');--> statement-breakpoint
CREATE TABLE "MeasurementResult" (
	"id" varchar PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"heartRate" real NOT NULL,
	"confidence" real NOT NULL,
	"rmssd" real,
	"sdnn" real,
	"lf" real,
	"hf" real,
	"lfHfRatio" real,
	"pnn50" real,
	"mood" varchar,
	"userId" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"email" varchar
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"name" varchar,
	"company" varchar DEFAULT '' NOT NULL,
	"password" varchar,
	"isAdmin" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "MeasurementResult" ADD CONSTRAINT "MeasurementResult_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
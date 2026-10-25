CREATE TABLE `budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cycle_start` text NOT NULL,
	`cycle_end` text NOT NULL,
	`salary` integer NOT NULL,
	`fixed_expenses` integer NOT NULL,
	`spending_budget` integer NOT NULL,
	`savings_target` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_cycle_start_unique` ON `budgets` (`cycle_start`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`counts_toward_budget` integer NOT NULL,
	`is_default` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `day_totals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`amount` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_totals_date_unique` ON `day_totals` (`date`);--> statement-breakpoint
CREATE TABLE `merchant_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyword` text NOT NULL,
	`category_id` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `merchant_rules_keyword_unique` ON `merchant_rules` (`keyword`);--> statement-breakpoint
CREATE TABLE `savings_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`currency_symbol` text DEFAULT '₹' NOT NULL,
	`cycle_start_day` integer DEFAULT 1 NOT NULL,
	`reminder_enabled` integer DEFAULT false NOT NULL,
	`reminder_time` text,
	`alert_threshold` integer DEFAULT 0 NOT NULL,
	`app_lock_enabled` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`category_id` integer NOT NULL,
	`description` text,
	`note` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`fingerprint` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);

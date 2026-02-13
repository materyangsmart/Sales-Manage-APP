CREATE TABLE `sales_commission_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rule_version` varchar(50) NOT NULL,
	`base_rate` varchar(20) NOT NULL,
	`new_customer_bonus` varchar(20) NOT NULL,
	`effective_date` varchar(10) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_commission_rules_id` PRIMARY KEY(`id`)
);

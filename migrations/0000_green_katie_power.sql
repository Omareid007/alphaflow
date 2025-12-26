CREATE TABLE "admin_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"is_secret" boolean DEFAULT false NOT NULL,
	"is_read_only" boolean DEFAULT false NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_settings_namespace_key_unique" UNIQUE("namespace","key")
);
--> statement-breakpoint
CREATE TABLE "agent_status" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_running" boolean DEFAULT false NOT NULL,
	"last_heartbeat" timestamp,
	"total_trades" integer DEFAULT 0,
	"total_pnl" numeric DEFAULT '0',
	"win_rate" numeric,
	"cash_balance" numeric DEFAULT '100000',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"kill_switch_active" boolean DEFAULT false NOT NULL,
	"max_position_size_percent" numeric DEFAULT '10',
	"max_total_exposure_percent" numeric DEFAULT '50',
	"max_positions_count" integer DEFAULT 10,
	"daily_loss_limit_percent" numeric DEFAULT '5',
	"dynamic_order_limit" integer DEFAULT 10,
	"min_order_limit" integer DEFAULT 10,
	"max_order_limit" integer DEFAULT 50,
	"market_condition" text DEFAULT 'neutral',
	"ai_confidence_score" numeric DEFAULT '0.5',
	"auto_start_enabled" boolean DEFAULT true NOT NULL,
	"last_market_analysis" timestamp,
	"auto_execute_trades" boolean DEFAULT false NOT NULL,
	"conservative_mode" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_agent_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"role" text NOT NULL,
	"mode" text DEFAULT 'cheap_first' NOT NULL,
	"temperature" numeric DEFAULT '0.7',
	"max_tokens" integer DEFAULT 2000,
	"prompt_template_id" varchar,
	"tool_policy" jsonb,
	"budget_limit_per_day" numeric,
	"budget_limit_per_run" numeric,
	"priority" integer DEFAULT 0,
	"status" text DEFAULT 'active' NOT NULL,
	"total_calls" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"total_cost_usd" numeric DEFAULT '0' NOT NULL,
	"avg_latency_ms" numeric,
	"success_rate" numeric,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_agent_profiles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "ai_arena_agent_decisions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"arena_run_id" varchar NOT NULL,
	"agent_profile_id" varchar NOT NULL,
	"role" text NOT NULL,
	"action" text NOT NULL,
	"symbols" text[],
	"confidence" numeric,
	"stance" text,
	"rationale" text,
	"key_signals" jsonb,
	"risks" jsonb,
	"proposed_order" jsonb,
	"tokens_used" integer,
	"cost_usd" numeric,
	"latency_ms" integer,
	"model_used" text,
	"was_escalation" boolean DEFAULT false,
	"raw_output" text,
	"tool_calls_count" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_arena_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" text NOT NULL,
	"mode" text DEFAULT 'debate' NOT NULL,
	"symbols" text[] NOT NULL,
	"agent_profile_ids" text[] NOT NULL,
	"market_snapshot_hash" text,
	"portfolio_snapshot_hash" text,
	"strategy_version_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration_ms" integer,
	"total_tokens_used" integer DEFAULT 0,
	"total_cost_usd" numeric DEFAULT '0',
	"escalation_triggered" boolean DEFAULT false,
	"escalation_reason" text,
	"consensus_reached" boolean,
	"final_decision" text,
	"disagreement_rate" numeric,
	"avg_confidence" numeric,
	"triggered_by" text,
	"outcome_linked" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_calibration_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calibration_type" text NOT NULL,
	"data_window_days" integer DEFAULT 30,
	"total_decisions" integer,
	"win_count" integer,
	"loss_count" integer,
	"avg_confidence_on_wins" numeric,
	"avg_confidence_on_losses" numeric,
	"avg_holding_time_wins" integer,
	"avg_holding_time_losses" integer,
	"top_winning_symbols" text,
	"top_losing_symbols" text,
	"recommended_adjustments" text,
	"model_version" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_decision_features" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" varchar NOT NULL,
	"symbol" text NOT NULL,
	"volatility" numeric,
	"trend_strength" numeric,
	"signal_agreement" numeric,
	"sentiment_score" numeric,
	"pe_ratio" numeric,
	"pb_ratio" numeric,
	"rsi" numeric,
	"macd_signal" text,
	"volume_ratio" numeric,
	"price_change_percent" numeric,
	"market_condition" text,
	"data_quality" numeric,
	"active_sources" integer,
	"feature_vector" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_decisions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"strategy_id" varchar,
	"symbol" text NOT NULL,
	"action" text NOT NULL,
	"confidence" numeric,
	"reasoning" text,
	"market_context" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"executed_trade_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"stop_loss" numeric,
	"take_profit" numeric,
	"entry_price" numeric,
	"filled_price" numeric,
	"filled_at" timestamp,
	"skip_reason" text,
	"trace_id" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "ai_outcome_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consensus_id" varchar,
	"debate_session_id" varchar,
	"decision_id" varchar,
	"work_item_id" varchar,
	"broker_order_id" varchar,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"intended_qty" numeric,
	"intended_notional" numeric,
	"filled_qty" numeric,
	"filled_avg_price" numeric,
	"fill_count" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"pnl_realized" numeric,
	"pnl_unrealized" numeric,
	"entry_price" numeric,
	"exit_price" numeric,
	"hold_duration_ms" integer,
	"outcome" text DEFAULT 'unknown',
	"llm_cost_usd" numeric,
	"trace_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_trade_outcomes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" varchar NOT NULL,
	"trade_id" varchar,
	"symbol" text NOT NULL,
	"action" text NOT NULL,
	"prediction_confidence" numeric,
	"entry_price" numeric,
	"exit_price" numeric,
	"quantity" numeric,
	"realized_pnl" numeric,
	"realized_pnl_percent" numeric,
	"holding_time_ms" integer,
	"is_win" boolean,
	"slippage_percent" numeric,
	"target_price_hit" boolean,
	"stop_loss_hit" boolean,
	"max_drawdown" numeric,
	"max_gain" numeric,
	"market_session_at_entry" text,
	"market_session_at_exit" text,
	"strategy_id" varchar,
	"exit_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "alert_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" varchar NOT NULL,
	"rule_name" text NOT NULL,
	"rule_type" text NOT NULL,
	"triggered_value" numeric NOT NULL,
	"threshold" numeric NOT NULL,
	"status" text DEFAULT 'triggered' NOT NULL,
	"webhook_sent" boolean DEFAULT false,
	"webhook_response" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rule_type" text NOT NULL,
	"condition" jsonb NOT NULL,
	"threshold" numeric NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"webhook_url" text,
	"last_triggered_at" timestamp,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "alert_rules_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "allocation_policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"max_position_weight_pct" numeric DEFAULT '8',
	"max_sector_weight_pct" numeric DEFAULT '25',
	"min_liquidity_tier" text DEFAULT 'B',
	"profit_taking_threshold_pct" numeric DEFAULT '20',
	"overweight_threshold_pct" numeric DEFAULT '50',
	"rotation_top_n" integer DEFAULT 10,
	"rebalance_frequency" text DEFAULT 'daily',
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "allocation_policies_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "analysis_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_analysis_id" varchar,
	"trade_outcome_id" varchar,
	"symbol" text NOT NULL,
	"source" text NOT NULL,
	"signal_at_entry" text,
	"confidence_at_entry" numeric,
	"trade_result" text,
	"pnl_percent" numeric,
	"signal_accuracy" boolean,
	"holding_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_classifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"asset_class" text,
	"market_cap_tier" text,
	"liquidity_tier" text,
	"volatility_tier" text,
	"trend_strength" text,
	"momentum_score" numeric,
	"value_score" numeric,
	"quality_score" numeric,
	"last_updated_at" timestamp DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"raw_json" jsonb,
	CONSTRAINT "asset_classifications_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"username" text,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"request_body" jsonb,
	"response_status" integer,
	"error_message" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backtest_equity_curve" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" varchar NOT NULL,
	"ts" timestamp NOT NULL,
	"equity" numeric NOT NULL,
	"cash" numeric NOT NULL,
	"exposure" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backtest_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"strategy_id" varchar,
	"strategy_config_hash" text NOT NULL,
	"strategy_config" jsonb NOT NULL,
	"universe" text[] NOT NULL,
	"broker" text NOT NULL,
	"timeframe" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"initial_cash" numeric NOT NULL,
	"fees_model" jsonb NOT NULL,
	"slippage_model" jsonb NOT NULL,
	"execution_price_rule" text NOT NULL,
	"data_source" text NOT NULL,
	"provenance" jsonb,
	"results_summary" jsonb,
	"error_message" text,
	"runtime_ms" integer
);
--> statement-breakpoint
CREATE TABLE "backtest_trade_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" varchar NOT NULL,
	"ts" timestamp NOT NULL,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"qty" numeric NOT NULL,
	"price" numeric NOT NULL,
	"reason" text NOT NULL,
	"order_type" text NOT NULL,
	"fees" numeric NOT NULL,
	"slippage" numeric NOT NULL,
	"position_after" numeric NOT NULL,
	"cash_after" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broker_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alpaca_id" text NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"asset_class" text NOT NULL,
	"exchange" text NOT NULL,
	"status" text NOT NULL,
	"tradable" boolean DEFAULT false NOT NULL,
	"marginable" boolean DEFAULT false NOT NULL,
	"shortable" boolean DEFAULT false NOT NULL,
	"easy_to_borrow" boolean DEFAULT false NOT NULL,
	"fractionable" boolean DEFAULT false NOT NULL,
	"min_order_size" numeric,
	"min_trade_increment" numeric,
	"price_increment" numeric,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "broker_assets_alpaca_id_unique" UNIQUE("alpaca_id"),
	CONSTRAINT "broker_assets_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "competition_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"trace_id" text NOT NULL,
	"mode" text NOT NULL,
	"trader_ids" text[] NOT NULL,
	"universe_symbols" text[],
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"duration_minutes" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competition_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" varchar NOT NULL,
	"trader_profile_id" varchar NOT NULL,
	"total_pnl" numeric DEFAULT '0' NOT NULL,
	"roi" numeric DEFAULT '0' NOT NULL,
	"max_drawdown" numeric DEFAULT '0' NOT NULL,
	"win_rate" numeric DEFAULT '0' NOT NULL,
	"avg_hold_time" integer,
	"trade_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"cost_per_decision" numeric,
	"slippage_proxy" numeric,
	"rank" integer,
	"snapshot_at" timestamp DEFAULT now() NOT NULL,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "connector_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector" text NOT NULL,
	"endpoint" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"total_requests" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"cache_hits" integer DEFAULT 0 NOT NULL,
	"cache_misses" integer DEFAULT 0 NOT NULL,
	"rate_limit_hits" integer DEFAULT 0 NOT NULL,
	"fallback_used" integer DEFAULT 0 NOT NULL,
	"avg_latency_ms" numeric,
	"p50_latency_ms" numeric,
	"p95_latency_ms" numeric,
	"p99_latency_ms" numeric,
	"last_error" text,
	"last_error_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "connector_metrics_connector_endpoint_date_unique" UNIQUE("connector","endpoint","date")
);
--> statement-breakpoint
CREATE TABLE "data_source_analysis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" varchar,
	"symbol" text NOT NULL,
	"source" text NOT NULL,
	"analysis_type" text NOT NULL,
	"data_json" jsonb NOT NULL,
	"score" numeric,
	"signal" text,
	"confidence" numeric,
	"reliability" numeric,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debate_consensus" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"decision" text NOT NULL,
	"order_intent" jsonb,
	"reasons_summary" text,
	"risk_checks" jsonb,
	"confidence" numeric,
	"dissent" jsonb,
	"work_item_id" varchar,
	"broker_order_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "debate_consensus_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "debate_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"role" text NOT NULL,
	"stance" text,
	"confidence" numeric,
	"key_signals" jsonb,
	"risks" jsonb,
	"invalidation_points" jsonb,
	"proposed_action" text,
	"proposed_order" jsonb,
	"evidence_refs" jsonb,
	"raw_output" text,
	"provider" text,
	"model" text,
	"tokens_used" integer,
	"estimated_cost" numeric,
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debate_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" text NOT NULL,
	"strategy_version_id" varchar,
	"symbols" text[] NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"triggered_by" text,
	"market_context" jsonb,
	"config" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration_ms" integer,
	"total_cost" numeric,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_api_cache_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"cache_key" text NOT NULL,
	"response_json" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"stale_until_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_api_usage_counters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"window_type" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"token_count" integer DEFAULT 0,
	"error_count" integer DEFAULT 0 NOT NULL,
	"rate_limit_hits" integer DEFAULT 0 NOT NULL,
	"cache_hits" integer DEFAULT 0 NOT NULL,
	"cache_misses" integer DEFAULT 0 NOT NULL,
	"avg_latency_ms" numeric,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker" text NOT NULL,
	"broker_order_id" text NOT NULL,
	"broker_fill_id" text,
	"order_id" varchar,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"qty" numeric NOT NULL,
	"price" numeric NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"trace_id" text,
	"raw_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fills_broker_fill_id_unique" UNIQUE("broker_fill_id")
);
--> statement-breakpoint
CREATE TABLE "insider_activity_analysis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"total_buys" numeric DEFAULT '0',
	"total_sells" numeric DEFAULT '0',
	"net_activity" numeric DEFAULT '0',
	"net_value" numeric DEFAULT '0',
	"buy_to_sell_ratio" numeric,
	"sentiment" text,
	"recent_transactions_json" jsonb,
	"analysis_window_days" integer DEFAULT 90,
	"analysis_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "insider_activity_symbol_date_unique" UNIQUE("symbol","analysis_date")
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"estimated_cost" numeric,
	"latency_ms" integer,
	"status" text DEFAULT 'success' NOT NULL,
	"error_message" text,
	"system_prompt" text,
	"user_prompt" text,
	"response" text,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"fallback_reason" text,
	"trace_id" text,
	"criticality" text,
	"purpose" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_role_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"description" text,
	"fallback_chain" text NOT NULL,
	"max_tokens" integer DEFAULT 1000,
	"temperature" numeric DEFAULT '0.3',
	"enable_citations" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "llm_role_configs_role_unique" UNIQUE("role")
);
--> statement-breakpoint
CREATE TABLE "macro_analysis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vix" numeric,
	"fed_funds_rate" numeric,
	"yield_curve" numeric,
	"inflation" numeric,
	"unemployment" numeric,
	"market_regime" text,
	"indicators_json" jsonb,
	"analysis_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "macro_analysis_date_unique" UNIQUE("analysis_date")
);
--> statement-breakpoint
CREATE TABLE "macro_indicators" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"indicator_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"latest_value" numeric,
	"previous_value" numeric,
	"change_percent" numeric,
	"frequency" text,
	"last_updated_at" timestamp DEFAULT now() NOT NULL,
	"source" text DEFAULT 'FRED' NOT NULL,
	"raw_json" jsonb,
	CONSTRAINT "macro_indicators_indicator_id_unique" UNIQUE("indicator_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"broker" text NOT NULL,
	"broker_order_id" text NOT NULL,
	"client_order_id" text,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"type" text NOT NULL,
	"time_in_force" text,
	"qty" numeric,
	"notional" numeric,
	"limit_price" numeric,
	"stop_price" numeric,
	"status" text NOT NULL,
	"extended_hours" boolean DEFAULT false,
	"order_class" text,
	"submitted_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"filled_at" timestamp,
	"expired_at" timestamp,
	"canceled_at" timestamp,
	"failed_at" timestamp,
	"filled_qty" numeric,
	"filled_avg_price" numeric,
	"trace_id" text,
	"decision_id" varchar,
	"trade_intent_id" varchar,
	"work_item_id" varchar,
	"raw_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_broker_order_id_unique" UNIQUE("broker_order_id"),
	CONSTRAINT "orders_client_order_id_unique" UNIQUE("client_order_id")
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"symbol" text NOT NULL,
	"quantity" numeric NOT NULL,
	"entry_price" numeric NOT NULL,
	"current_price" numeric,
	"unrealized_pnl" numeric,
	"side" text NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"strategy_id" varchar
);
--> statement-breakpoint
CREATE TABLE "rebalance_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" varchar,
	"trace_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"trigger_type" text NOT NULL,
	"input_snapshot" jsonb,
	"order_intents" jsonb,
	"executed_orders" jsonb,
	"rationale" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "short_interest_analysis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"short_ratio" numeric NOT NULL,
	"short_volume" numeric,
	"total_volume" numeric,
	"days_to_cover" numeric,
	"short_ratio_trend" text,
	"squeeze_potential" text,
	"average_short_ratio" numeric,
	"analysis_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "short_interest_symbol_date_unique" UNIQUE("symbol","analysis_date")
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"assets" text[],
	"parameters" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy_id" varchar NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"spec" jsonb NOT NULL,
	"universe_config" jsonb,
	"signals_config" jsonb,
	"risk_config" jsonb,
	"llm_policy" jsonb,
	"prompt_template" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"dry_run_result" jsonb,
	"change_notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"activated_at" timestamp,
	CONSTRAINT "strategy_versions_unique" UNIQUE("strategy_id","version")
);
--> statement-breakpoint
CREATE TABLE "tool_invocations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"category" text NOT NULL,
	"input_params" jsonb,
	"output_result" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"latency_ms" integer,
	"caller_role" text,
	"debate_session_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trader_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"strategy_version_id" varchar,
	"model_profile" jsonb,
	"risk_preset" jsonb,
	"universe_filter" jsonb,
	"is_promoted" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trader_profiles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"strategy_id" varchar,
	"order_id" varchar,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"quantity" numeric NOT NULL,
	"price" numeric NOT NULL,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	"pnl" numeric,
	"status" text DEFAULT 'completed' NOT NULL,
	"notes" text,
	"trace_id" text
);
--> statement-breakpoint
CREATE TABLE "universe_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"exchange" text NOT NULL,
	"asset_class" text NOT NULL,
	"status" text NOT NULL,
	"tradable" boolean DEFAULT false NOT NULL,
	"marginable" boolean DEFAULT false NOT NULL,
	"shortable" boolean DEFAULT false NOT NULL,
	"fractionable" boolean DEFAULT false NOT NULL,
	"easy_to_borrow" boolean DEFAULT false NOT NULL,
	"is_otc" boolean DEFAULT false NOT NULL,
	"is_spac" boolean DEFAULT false NOT NULL,
	"is_penny_stock" boolean DEFAULT false NOT NULL,
	"excluded" boolean DEFAULT false NOT NULL,
	"exclude_reason" text,
	"last_refreshed_at" timestamp DEFAULT now() NOT NULL,
	"raw_json" jsonb,
	CONSTRAINT "universe_assets_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "universe_candidates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"tier" text NOT NULL,
	"liquidity_score" numeric,
	"growth_score" numeric,
	"quality_score" numeric,
	"final_score" numeric,
	"theme_tags" jsonb,
	"rationale" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"trace_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "universe_candidates_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "universe_fundamentals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"market_cap" numeric,
	"revenue_ttm" numeric,
	"revenue_cagr_3y" numeric,
	"gross_margin" numeric,
	"operating_margin" numeric,
	"net_margin" numeric,
	"free_cash_flow_margin" numeric,
	"debt_to_equity" numeric,
	"shares_dilution_1y" numeric,
	"pe_ratio" numeric,
	"price_to_book" numeric,
	"beta" numeric,
	"week_52_high" numeric,
	"week_52_low" numeric,
	"dividend_yield" numeric,
	"sector" text,
	"industry" text,
	"source" text NOT NULL,
	"last_updated_at" timestamp DEFAULT now() NOT NULL,
	"raw_json" jsonb,
	CONSTRAINT "universe_fundamentals_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "universe_liquidity_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"avg_daily_volume_shares" numeric,
	"avg_daily_traded_value_usd" numeric,
	"avg_bid_ask_spread_pct" numeric,
	"latest_price" numeric,
	"price_data_days" integer DEFAULT 30,
	"liquidity_tier" text,
	"source" text NOT NULL,
	"last_updated_at" timestamp DEFAULT now() NOT NULL,
	"raw_json" jsonb,
	CONSTRAINT "universe_liquidity_metrics_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "universe_technicals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"date" timestamp NOT NULL,
	"open" numeric,
	"high" numeric,
	"low" numeric,
	"close" numeric,
	"volume" numeric,
	"vwap" numeric,
	"sma_20" numeric,
	"sma_50" numeric,
	"sma_200" numeric,
	"ema_12" numeric,
	"ema_26" numeric,
	"rsi_14" numeric,
	"macd" numeric,
	"macd_signal" numeric,
	"macd_histogram" numeric,
	"atr_14" numeric,
	"bollinger_upper" numeric,
	"bollinger_lower" numeric,
	"adx_14" numeric,
	"plus_di" numeric,
	"minus_di" numeric,
	"pivot_point" numeric,
	"resistance_1" numeric,
	"support_1" numeric,
	"source" text NOT NULL,
	"last_updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "universe_technicals_symbol_date_unique" UNIQUE("symbol","date")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "valyu_retrieval_counters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_tier" text NOT NULL,
	"month_key" text NOT NULL,
	"retrieval_count" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_item_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_item_id" varchar NOT NULL,
	"attempt_number" integer NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"error" text,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_run_at" timestamp DEFAULT now() NOT NULL,
	"last_error" text,
	"payload" text,
	"idempotency_key" text,
	"decision_id" varchar,
	"broker_order_id" text,
	"symbol" text,
	"result" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "work_items_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_settings" ADD CONSTRAINT "admin_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_arena_agent_decisions" ADD CONSTRAINT "ai_arena_agent_decisions_arena_run_id_ai_arena_runs_id_fk" FOREIGN KEY ("arena_run_id") REFERENCES "public"."ai_arena_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_arena_agent_decisions" ADD CONSTRAINT "ai_arena_agent_decisions_agent_profile_id_ai_agent_profiles_id_fk" FOREIGN KEY ("agent_profile_id") REFERENCES "public"."ai_agent_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_arena_runs" ADD CONSTRAINT "ai_arena_runs_strategy_version_id_strategy_versions_id_fk" FOREIGN KEY ("strategy_version_id") REFERENCES "public"."strategy_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_decision_features" ADD CONSTRAINT "ai_decision_features_decision_id_ai_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."ai_decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_decisions" ADD CONSTRAINT "ai_decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_decisions" ADD CONSTRAINT "ai_decisions_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_decisions" ADD CONSTRAINT "ai_decisions_executed_trade_id_trades_id_fk" FOREIGN KEY ("executed_trade_id") REFERENCES "public"."trades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_outcome_links" ADD CONSTRAINT "ai_outcome_links_consensus_id_debate_consensus_id_fk" FOREIGN KEY ("consensus_id") REFERENCES "public"."debate_consensus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_outcome_links" ADD CONSTRAINT "ai_outcome_links_debate_session_id_debate_sessions_id_fk" FOREIGN KEY ("debate_session_id") REFERENCES "public"."debate_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_outcome_links" ADD CONSTRAINT "ai_outcome_links_decision_id_ai_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."ai_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_outcome_links" ADD CONSTRAINT "ai_outcome_links_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_trade_outcomes" ADD CONSTRAINT "ai_trade_outcomes_decision_id_ai_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."ai_decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_trade_outcomes" ADD CONSTRAINT "ai_trade_outcomes_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_trade_outcomes" ADD CONSTRAINT "ai_trade_outcomes_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_policies" ADD CONSTRAINT "allocation_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_feedback" ADD CONSTRAINT "analysis_feedback_data_source_analysis_id_data_source_analysis_id_fk" FOREIGN KEY ("data_source_analysis_id") REFERENCES "public"."data_source_analysis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_feedback" ADD CONSTRAINT "analysis_feedback_trade_outcome_id_ai_trade_outcomes_id_fk" FOREIGN KEY ("trade_outcome_id") REFERENCES "public"."ai_trade_outcomes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_equity_curve" ADD CONSTRAINT "backtest_equity_curve_run_id_backtest_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."backtest_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_runs" ADD CONSTRAINT "backtest_runs_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_trade_events" ADD CONSTRAINT "backtest_trade_events_run_id_backtest_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."backtest_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_scores" ADD CONSTRAINT "competition_scores_run_id_competition_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."competition_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_scores" ADD CONSTRAINT "competition_scores_trader_profile_id_trader_profiles_id_fk" FOREIGN KEY ("trader_profile_id") REFERENCES "public"."trader_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_source_analysis" ADD CONSTRAINT "data_source_analysis_decision_id_ai_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."ai_decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_consensus" ADD CONSTRAINT "debate_consensus_session_id_debate_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."debate_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_consensus" ADD CONSTRAINT "debate_consensus_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debate_messages" ADD CONSTRAINT "debate_messages_session_id_debate_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."debate_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fills" ADD CONSTRAINT "fills_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_decision_id_ai_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."ai_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_trade_intent_id_trades_id_fk" FOREIGN KEY ("trade_intent_id") REFERENCES "public"."trades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalance_runs" ADD CONSTRAINT "rebalance_runs_policy_id_allocation_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."allocation_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_versions" ADD CONSTRAINT "strategy_versions_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_debate_session_id_debate_sessions_id_fk" FOREIGN KEY ("debate_session_id") REFERENCES "public"."debate_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universe_candidates" ADD CONSTRAINT "universe_candidates_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_runs" ADD CONSTRAINT "work_item_runs_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_decision_id_ai_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."ai_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_settings_namespace_idx" ON "admin_settings" USING btree ("namespace");--> statement-breakpoint
CREATE INDEX "admin_settings_key_idx" ON "admin_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "ai_agent_profiles_status_idx" ON "ai_agent_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_agent_profiles_role_idx" ON "ai_agent_profiles" USING btree ("role");--> statement-breakpoint
CREATE INDEX "ai_agent_profiles_mode_idx" ON "ai_agent_profiles" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "ai_arena_agent_decisions_run_id_idx" ON "ai_arena_agent_decisions" USING btree ("arena_run_id");--> statement-breakpoint
CREATE INDEX "ai_arena_agent_decisions_agent_profile_id_idx" ON "ai_arena_agent_decisions" USING btree ("agent_profile_id");--> statement-breakpoint
CREATE INDEX "ai_arena_agent_decisions_role_idx" ON "ai_arena_agent_decisions" USING btree ("role");--> statement-breakpoint
CREATE INDEX "ai_arena_runs_trace_id_idx" ON "ai_arena_runs" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "ai_arena_runs_status_idx" ON "ai_arena_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_arena_runs_mode_idx" ON "ai_arena_runs" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "ai_arena_runs_created_at_idx" ON "ai_arena_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_decisions_user_id_idx" ON "ai_decisions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_outcome_links_consensus_id_idx" ON "ai_outcome_links" USING btree ("consensus_id");--> statement-breakpoint
CREATE INDEX "ai_outcome_links_debate_session_id_idx" ON "ai_outcome_links" USING btree ("debate_session_id");--> statement-breakpoint
CREATE INDEX "ai_outcome_links_work_item_id_idx" ON "ai_outcome_links" USING btree ("work_item_id");--> statement-breakpoint
CREATE INDEX "ai_outcome_links_symbol_idx" ON "ai_outcome_links" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "ai_outcome_links_status_idx" ON "ai_outcome_links" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_outcome_links_outcome_idx" ON "ai_outcome_links" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "ai_outcome_links_created_at_idx" ON "ai_outcome_links" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "alert_events_rule_id_idx" ON "alert_events" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "alert_events_created_at_idx" ON "alert_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "alert_rules_enabled_idx" ON "alert_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "alert_rules_type_idx" ON "alert_rules" USING btree ("rule_type");--> statement-breakpoint
CREATE INDEX "allocation_policies_active_idx" ON "allocation_policies" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "analysis_feedback_source_idx" ON "analysis_feedback" USING btree ("source");--> statement-breakpoint
CREATE INDEX "analysis_feedback_symbol_idx" ON "analysis_feedback" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "analysis_feedback_created_at_idx" ON "analysis_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "asset_classifications_symbol_idx" ON "asset_classifications" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "asset_classifications_asset_class_idx" ON "asset_classifications" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "asset_classifications_market_cap_tier_idx" ON "asset_classifications" USING btree ("market_cap_tier");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "backtest_equity_curve_run_id_idx" ON "backtest_equity_curve" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "backtest_equity_curve_ts_idx" ON "backtest_equity_curve" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "backtest_runs_status_idx" ON "backtest_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "backtest_runs_strategy_id_idx" ON "backtest_runs" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "backtest_runs_created_at_idx" ON "backtest_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "backtest_trade_events_run_id_idx" ON "backtest_trade_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "backtest_trade_events_ts_idx" ON "backtest_trade_events" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "backtest_trade_events_symbol_idx" ON "backtest_trade_events" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "competition_runs_trace_id_idx" ON "competition_runs" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "competition_runs_status_idx" ON "competition_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "competition_scores_run_id_idx" ON "competition_scores" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "competition_scores_trader_id_idx" ON "competition_scores" USING btree ("trader_profile_id");--> statement-breakpoint
CREATE INDEX "competition_scores_rank_idx" ON "competition_scores" USING btree ("rank");--> statement-breakpoint
CREATE INDEX "connector_metrics_connector_idx" ON "connector_metrics" USING btree ("connector");--> statement-breakpoint
CREATE INDEX "connector_metrics_date_idx" ON "connector_metrics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "data_source_analysis_decision_id_idx" ON "data_source_analysis" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "data_source_analysis_symbol_idx" ON "data_source_analysis" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "data_source_analysis_source_idx" ON "data_source_analysis" USING btree ("source");--> statement-breakpoint
CREATE INDEX "data_source_analysis_created_at_idx" ON "data_source_analysis" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "debate_consensus_session_id_idx" ON "debate_consensus" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "debate_consensus_work_item_id_idx" ON "debate_consensus" USING btree ("work_item_id");--> statement-breakpoint
CREATE INDEX "debate_messages_session_id_idx" ON "debate_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "debate_messages_role_idx" ON "debate_messages" USING btree ("role");--> statement-breakpoint
CREATE INDEX "debate_sessions_trace_id_idx" ON "debate_sessions" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "debate_sessions_status_idx" ON "debate_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "debate_sessions_created_at_idx" ON "debate_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "fills_broker_order_id_idx" ON "fills" USING btree ("broker_order_id");--> statement-breakpoint
CREATE INDEX "fills_order_id_idx" ON "fills" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "fills_symbol_idx" ON "fills" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "fills_trace_id_idx" ON "fills" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "insider_activity_symbol_idx" ON "insider_activity_analysis" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "insider_activity_date_idx" ON "insider_activity_analysis" USING btree ("analysis_date");--> statement-breakpoint
CREATE INDEX "macro_analysis_date_idx" ON "macro_analysis" USING btree ("analysis_date");--> statement-breakpoint
CREATE INDEX "macro_indicators_category_idx" ON "macro_indicators" USING btree ("category");--> statement-breakpoint
CREATE INDEX "macro_indicators_indicator_id_idx" ON "macro_indicators" USING btree ("indicator_id");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_broker_order_id_idx" ON "orders" USING btree ("broker_order_id");--> statement-breakpoint
CREATE INDEX "orders_client_order_id_idx" ON "orders" USING btree ("client_order_id");--> statement-breakpoint
CREATE INDEX "orders_symbol_idx" ON "orders" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_trace_id_idx" ON "orders" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "orders_decision_id_idx" ON "orders" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "positions_user_id_idx" ON "positions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rebalance_runs_trace_id_idx" ON "rebalance_runs" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "rebalance_runs_status_idx" ON "rebalance_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "short_interest_symbol_idx" ON "short_interest_analysis" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "short_interest_date_idx" ON "short_interest_analysis" USING btree ("analysis_date");--> statement-breakpoint
CREATE INDEX "strategy_versions_strategy_id_idx" ON "strategy_versions" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "strategy_versions_status_idx" ON "strategy_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tool_invocations_trace_id_idx" ON "tool_invocations" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "tool_invocations_tool_name_idx" ON "tool_invocations" USING btree ("tool_name");--> statement-breakpoint
CREATE INDEX "tool_invocations_created_at_idx" ON "tool_invocations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tool_invocations_session_id_idx" ON "tool_invocations" USING btree ("debate_session_id");--> statement-breakpoint
CREATE INDEX "trader_profiles_status_idx" ON "trader_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trader_profiles_promoted_idx" ON "trader_profiles" USING btree ("is_promoted");--> statement-breakpoint
CREATE INDEX "trades_user_id_idx" ON "trades" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "universe_assets_symbol_idx" ON "universe_assets" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "universe_assets_tradable_idx" ON "universe_assets" USING btree ("tradable");--> statement-breakpoint
CREATE INDEX "universe_assets_exchange_idx" ON "universe_assets" USING btree ("exchange");--> statement-breakpoint
CREATE INDEX "universe_candidates_symbol_idx" ON "universe_candidates" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "universe_candidates_status_idx" ON "universe_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "universe_candidates_tier_idx" ON "universe_candidates" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "universe_candidates_final_score_idx" ON "universe_candidates" USING btree ("final_score");--> statement-breakpoint
CREATE INDEX "universe_fundamentals_symbol_idx" ON "universe_fundamentals" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "universe_fundamentals_sector_idx" ON "universe_fundamentals" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "universe_liquidity_symbol_idx" ON "universe_liquidity_metrics" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "universe_liquidity_tier_idx" ON "universe_liquidity_metrics" USING btree ("liquidity_tier");--> statement-breakpoint
CREATE INDEX "universe_technicals_symbol_idx" ON "universe_technicals" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "universe_technicals_date_idx" ON "universe_technicals" USING btree ("date");
CREATE TABLE "region" (
	"region_code" text PRIMARY KEY NOT NULL,
	"region_name" text NOT NULL,
	"kpx_region_name" text,
	"kma_grid_x" integer,
	"kma_grid_y" integer,
	"lat" numeric(9, 6),
	"lon" numeric(9, 6),
	"sido_name" text,
	"sigungu_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasource" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"source_type" text NOT NULL,
	"update_cycle" text,
	"url" text,
	"license" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "datasource_name_provider_uq" UNIQUE("name","provider")
);
--> statement-breakpoint
CREATE TABLE "ops_data_quality_check" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ingestion_run_id" bigint,
	"check_name" text NOT NULL,
	"status" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ops_data_quality_check_status_ck" CHECK ("ops_data_quality_check"."status" IN ('pass','warn','fail'))
);
--> statement-breakpoint
CREATE TABLE "ops_ingestion_run" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"datasource_id" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"requested_from" timestamp with time zone,
	"requested_to" timestamp with time zone,
	"row_count" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ops_ingestion_run_status_ck" CHECK ("ops_ingestion_run"."status" IN ('running','success','failed','partial'))
);
--> statement-breakpoint
CREATE TABLE "raw_object" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"datasource_id" integer NOT NULL,
	"ingestion_run_id" bigint NOT NULL,
	"object_path" text NOT NULL,
	"content_type" text,
	"content_hash" text NOT NULL,
	"source_url" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "raw_object_datasource_hash_uq" UNIQUE("datasource_id","content_hash")
);
--> statement-breakpoint
CREATE TABLE "mart_demand_hourly" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"interval_start_at" timestamp with time zone NOT NULL,
	"interval_end_at" timestamp with time zone NOT NULL,
	"demand_mwh" numeric(12, 3) NOT NULL,
	"datasource_id" integer NOT NULL,
	"ingestion_run_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mart_demand_hourly_uq" UNIQUE("interval_start_at","datasource_id"),
	CONSTRAINT "mart_demand_hourly_value_ck" CHECK ("mart_demand_hourly"."demand_mwh" >= 0),
	CONSTRAINT "mart_demand_hourly_interval_ck" CHECK ("mart_demand_hourly"."interval_end_at" = "mart_demand_hourly"."interval_start_at" + interval '1 hour')
);
--> statement-breakpoint
CREATE TABLE "mart_generation_hourly" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"interval_start_at" timestamp with time zone NOT NULL,
	"interval_end_at" timestamp with time zone NOT NULL,
	"source_date" date NOT NULL,
	"source_hour" integer NOT NULL,
	"region_code" text NOT NULL,
	"fuel_type" text NOT NULL,
	"generation_mwh" numeric(12, 3) NOT NULL,
	"includes_ess" boolean,
	"datasource_id" integer NOT NULL,
	"ingestion_run_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mart_generation_hourly_uq" UNIQUE("interval_start_at","region_code","fuel_type","datasource_id"),
	CONSTRAINT "mart_generation_hourly_source_hour_ck" CHECK ("mart_generation_hourly"."source_hour" BETWEEN 0 AND 24),
	CONSTRAINT "mart_generation_hourly_fuel_type_ck" CHECK ("mart_generation_hourly"."fuel_type" IN ('SOLAR','WIND')),
	CONSTRAINT "mart_generation_hourly_generation_ck" CHECK ("mart_generation_hourly"."generation_mwh" >= 0),
	CONSTRAINT "mart_generation_hourly_interval_ck" CHECK ("mart_generation_hourly"."interval_end_at" = "mart_generation_hourly"."interval_start_at" + interval '1 hour')
);
--> statement-breakpoint
CREATE TABLE "mart_rec_market_daily" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"trade_date" date NOT NULL,
	"market_area" text NOT NULL,
	"trade_count" integer,
	"volume_rec" numeric(14, 3),
	"avg_price_krw_per_rec" numeric(12, 2),
	"high_price_krw_per_rec" numeric(12, 2),
	"low_price_krw_per_rec" numeric(12, 2),
	"close_price_krw_per_rec" numeric(12, 2),
	"total_trade_amount_krw" numeric(18, 2),
	"datasource_id" integer NOT NULL,
	"ingestion_run_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mart_rec_market_daily_uq" UNIQUE("trade_date","market_area","datasource_id"),
	CONSTRAINT "mart_rec_market_daily_market_area_ck" CHECK ("mart_rec_market_daily"."market_area" IN ('LAND','JEJU','TOTAL'))
);
--> statement-breakpoint
CREATE TABLE "mart_smp_hourly" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"interval_start_at" timestamp with time zone NOT NULL,
	"interval_end_at" timestamp with time zone NOT NULL,
	"source_date" date NOT NULL,
	"source_hour" integer NOT NULL,
	"market_area" text NOT NULL,
	"smp_krw_per_kwh" numeric(10, 2) NOT NULL,
	"datasource_id" integer NOT NULL,
	"ingestion_run_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mart_smp_hourly_uq" UNIQUE("interval_start_at","market_area","datasource_id"),
	CONSTRAINT "mart_smp_hourly_source_hour_ck" CHECK ("mart_smp_hourly"."source_hour" BETWEEN 0 AND 24),
	CONSTRAINT "mart_smp_hourly_market_area_ck" CHECK ("mart_smp_hourly"."market_area" IN ('LAND','JEJU')),
	CONSTRAINT "mart_smp_hourly_value_ck" CHECK ("mart_smp_hourly"."smp_krw_per_kwh" BETWEEN 0 AND 1000),
	CONSTRAINT "mart_smp_hourly_interval_ck" CHECK ("mart_smp_hourly"."interval_end_at" = "mart_smp_hourly"."interval_start_at" + interval '1 hour')
);
--> statement-breakpoint
CREATE TABLE "mart_solar_irradiance" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"observed_at_utc" timestamp with time zone NOT NULL,
	"observed_at_kst" timestamp with time zone NOT NULL,
	"region_code" text NOT NULL,
	"irradiance_value" numeric(10, 3),
	"irradiance_unit" text,
	"datasource_id" integer NOT NULL,
	"ingestion_run_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mart_solar_irradiance_uq" UNIQUE("observed_at_utc","region_code","datasource_id"),
	CONSTRAINT "mart_solar_irradiance_utc_kst_ck" CHECK ("mart_solar_irradiance"."observed_at_kst" = "mart_solar_irradiance"."observed_at_utc" + interval '9 hours')
);
--> statement-breakpoint
CREATE TABLE "mart_supply_realtime" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"slot_at" timestamp with time zone NOT NULL,
	"supply_ability_mw" numeric(10, 2),
	"current_demand_mw" numeric(10, 2),
	"forecast_load_mw" numeric(10, 2),
	"reserve_power_mw" numeric(10, 2),
	"reserve_rate_pct" numeric(5, 2),
	"operating_reserve_power_mw" numeric(10, 2),
	"operating_reserve_rate_pct" numeric(5, 2),
	"datasource_id" integer NOT NULL,
	"ingestion_run_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mart_supply_realtime_uq" UNIQUE("slot_at","datasource_id")
);
--> statement-breakpoint
CREATE TABLE "mart_weather_forecast_hourly" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"base_at" timestamp with time zone NOT NULL,
	"forecast_at" timestamp with time zone NOT NULL,
	"region_code" text NOT NULL,
	"temperature_c" numeric(5, 2),
	"humidity_pct" numeric(5, 2),
	"precipitation_mm" numeric(7, 2),
	"precipitation_prob_pct" numeric(5, 2),
	"wind_speed_ms" numeric(5, 2),
	"sky_code" text,
	"datasource_id" integer NOT NULL,
	"ingestion_run_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mart_weather_forecast_hourly_uq" UNIQUE("base_at","forecast_at","region_code","datasource_id")
);
--> statement-breakpoint
CREATE TABLE "model_generation_forecast_hourly" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"forecast_run_at" timestamp with time zone NOT NULL,
	"target_at" timestamp with time zone NOT NULL,
	"region_code" text NOT NULL,
	"fuel_type" text NOT NULL,
	"predicted_generation_mwh" numeric(12, 3) NOT NULL,
	"actual_generation_mwh" numeric(12, 3),
	"model_name" text NOT NULL,
	"model_version" text,
	"feature_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "model_generation_forecast_hourly_uq" UNIQUE("forecast_run_at","target_at","region_code","fuel_type","model_name"),
	CONSTRAINT "model_generation_forecast_hourly_fuel_type_ck" CHECK ("model_generation_forecast_hourly"."fuel_type" IN ('SOLAR','WIND')),
	CONSTRAINT "model_generation_forecast_hourly_predicted_ck" CHECK ("model_generation_forecast_hourly"."predicted_generation_mwh" >= 0),
	CONSTRAINT "model_generation_forecast_hourly_actual_ck" CHECK ("model_generation_forecast_hourly"."actual_generation_mwh" IS NULL OR "model_generation_forecast_hourly"."actual_generation_mwh" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ops_data_quality_check" ADD CONSTRAINT "ops_data_quality_check_ingestion_run_id_ops_ingestion_run_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ops_ingestion_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_ingestion_run" ADD CONSTRAINT "ops_ingestion_run_datasource_id_datasource_id_fk" FOREIGN KEY ("datasource_id") REFERENCES "public"."datasource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_object" ADD CONSTRAINT "raw_object_datasource_id_datasource_id_fk" FOREIGN KEY ("datasource_id") REFERENCES "public"."datasource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_object" ADD CONSTRAINT "raw_object_ingestion_run_id_ops_ingestion_run_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ops_ingestion_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_demand_hourly" ADD CONSTRAINT "mart_demand_hourly_datasource_id_datasource_id_fk" FOREIGN KEY ("datasource_id") REFERENCES "public"."datasource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_demand_hourly" ADD CONSTRAINT "mart_demand_hourly_ingestion_run_id_ops_ingestion_run_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ops_ingestion_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_generation_hourly" ADD CONSTRAINT "mart_generation_hourly_region_code_region_region_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."region"("region_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_generation_hourly" ADD CONSTRAINT "mart_generation_hourly_datasource_id_datasource_id_fk" FOREIGN KEY ("datasource_id") REFERENCES "public"."datasource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_generation_hourly" ADD CONSTRAINT "mart_generation_hourly_ingestion_run_id_ops_ingestion_run_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ops_ingestion_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_rec_market_daily" ADD CONSTRAINT "mart_rec_market_daily_datasource_id_datasource_id_fk" FOREIGN KEY ("datasource_id") REFERENCES "public"."datasource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_rec_market_daily" ADD CONSTRAINT "mart_rec_market_daily_ingestion_run_id_ops_ingestion_run_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ops_ingestion_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_smp_hourly" ADD CONSTRAINT "mart_smp_hourly_datasource_id_datasource_id_fk" FOREIGN KEY ("datasource_id") REFERENCES "public"."datasource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_smp_hourly" ADD CONSTRAINT "mart_smp_hourly_ingestion_run_id_ops_ingestion_run_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ops_ingestion_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_solar_irradiance" ADD CONSTRAINT "mart_solar_irradiance_region_code_region_region_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."region"("region_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_solar_irradiance" ADD CONSTRAINT "mart_solar_irradiance_datasource_id_datasource_id_fk" FOREIGN KEY ("datasource_id") REFERENCES "public"."datasource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_solar_irradiance" ADD CONSTRAINT "mart_solar_irradiance_ingestion_run_id_ops_ingestion_run_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ops_ingestion_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_supply_realtime" ADD CONSTRAINT "mart_supply_realtime_datasource_id_datasource_id_fk" FOREIGN KEY ("datasource_id") REFERENCES "public"."datasource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_supply_realtime" ADD CONSTRAINT "mart_supply_realtime_ingestion_run_id_ops_ingestion_run_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ops_ingestion_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_weather_forecast_hourly" ADD CONSTRAINT "mart_weather_forecast_hourly_region_code_region_region_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."region"("region_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_weather_forecast_hourly" ADD CONSTRAINT "mart_weather_forecast_hourly_datasource_id_datasource_id_fk" FOREIGN KEY ("datasource_id") REFERENCES "public"."datasource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mart_weather_forecast_hourly" ADD CONSTRAINT "mart_weather_forecast_hourly_ingestion_run_id_ops_ingestion_run_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ops_ingestion_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_generation_forecast_hourly" ADD CONSTRAINT "model_generation_forecast_hourly_region_code_region_region_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."region"("region_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ops_ingestion_run_datasource_started_idx" ON "ops_ingestion_run" USING btree ("datasource_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "raw_object_datasource_fetched_idx" ON "raw_object" USING btree ("datasource_id","fetched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "mart_generation_hourly_region_fuel_start_idx" ON "mart_generation_hourly" USING btree ("region_code","fuel_type","interval_start_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "mart_rec_market_daily_area_date_idx" ON "mart_rec_market_daily" USING btree ("market_area","trade_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "mart_smp_hourly_area_start_idx" ON "mart_smp_hourly" USING btree ("market_area","interval_start_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "mart_solar_irradiance_region_observed_idx" ON "mart_solar_irradiance" USING btree ("region_code","observed_at_kst" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "mart_supply_realtime_slot_idx" ON "mart_supply_realtime" USING btree ("slot_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "mart_weather_forecast_hourly_region_forecast_idx" ON "mart_weather_forecast_hourly" USING btree ("region_code","forecast_at");
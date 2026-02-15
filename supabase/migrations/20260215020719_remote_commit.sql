alter table "public"."numerology_profiles" add column "config_version" text;

alter table "public"."numerology_profiles" add column "input_json" jsonb;

alter table "public"."numerology_profiles" add column "numerology_json" jsonb;

alter table "public"."numerology_profiles" add column "numerology_key" text;

CREATE UNIQUE INDEX numerology_profiles_numerology_key_key ON public.numerology_profiles USING btree (numerology_key);

alter table "public"."numerology_profiles" add constraint "numerology_profiles_numerology_key_key" UNIQUE using index "numerology_profiles_numerology_key_key";

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();



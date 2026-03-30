-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.candidate (
  id integer NOT NULL DEFAULT nextval('candidate_id_seq'::regclass),
  user_id integer NOT NULL UNIQUE,
  full_name character varying,
  gender character varying,
  phone character varying,
  avatar_url character varying,
  cv_url character varying,
  bio text,
  province_id integer,
  position character varying,
  salary_min numeric,
  salary_max numeric,
  job_type_id integer,
  year_working_experience integer,
  CONSTRAINT candidate_pkey PRIMARY KEY (id),
  CONSTRAINT FK_77af458165fe750934e8425031b FOREIGN KEY (user_id) REFERENCES public.user(id),
  CONSTRAINT FK_d2d3bed68e22a32d7dabfa940f0 FOREIGN KEY (job_type_id) REFERENCES public.job_type_metadata(id)
);
CREATE TABLE public.candidate_job_category (
  id integer NOT NULL DEFAULT nextval('candidate_job_category_id_seq'::regclass),
  candidate_id integer NOT NULL,
  job_category_id integer NOT NULL,
  CONSTRAINT candidate_job_category_pkey PRIMARY KEY (id),
  CONSTRAINT FK_15f686594fadaa8343c1328ac12 FOREIGN KEY (job_category_id) REFERENCES public.job_category_metadata(id),
  CONSTRAINT FK_7c8809be2c6678f1865b5d8329a FOREIGN KEY (candidate_id) REFERENCES public.candidate(id)
);
CREATE TABLE public.candidate_skill_tag (
  id integer NOT NULL DEFAULT nextval('candidate_skill_tag_id_seq'::regclass),
  candidate_id integer NOT NULL,
  skill_metadata_id integer NOT NULL,
  CONSTRAINT candidate_skill_tag_pkey PRIMARY KEY (id),
  CONSTRAINT FK_aa0eddc83dc8172af462980549b FOREIGN KEY (candidate_id) REFERENCES public.candidate(id),
  CONSTRAINT FK_236ccc3920c30ec48fbefc4e009 FOREIGN KEY (skill_metadata_id) REFERENCES public.skill_metadata(id)
);
CREATE TABLE public.certificate (
  id integer NOT NULL DEFAULT nextval('certificate_id_seq'::regclass),
  candidate_id integer NOT NULL,
  name character varying NOT NULL,
  cer_img_url character varying,
  CONSTRAINT certificate_pkey PRIMARY KEY (id),
  CONSTRAINT FK_ecbb7801eb205538825fa89b2bb FOREIGN KEY (candidate_id) REFERENCES public.candidate(id)
);
CREATE TABLE public.company (
  id integer NOT NULL DEFAULT nextval('company_id_seq'::regclass),
  user_creator_id integer NOT NULL UNIQUE,
  category_id integer NOT NULL,
  name character varying NOT NULL,
  email_contact character varying,
  phone_contact character varying,
  address text,
  province_id integer,
  logo_url character varying,
  banner_url character varying,
  description text,
  content text,
  company_size character varying,
  website_url character varying,
  facebook_url character varying,
  linkedin_url character varying,
  business_license_url character varying,
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT company_pkey PRIMARY KEY (id)
);
CREATE TABLE public.company_image (
  id integer NOT NULL DEFAULT nextval('company_image_id_seq'::regclass),
  company_id integer NOT NULL,
  image_url character varying NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT company_image_pkey PRIMARY KEY (id),
  CONSTRAINT FK_b439a47c162561ac50ffdf27a9f FOREIGN KEY (company_id) REFERENCES public.company(id)
);
CREATE TABLE public.education (
  id integer NOT NULL DEFAULT nextval('education_id_seq'::regclass),
  candidate_id integer NOT NULL,
  school_name character varying NOT NULL,
  major character varying,
  degree character varying,
  start_date date,
  end_date date,
  is_still_studying boolean,
  description text,
  CONSTRAINT education_pkey PRIMARY KEY (id),
  CONSTRAINT FK_e5cd2741ebeb6c59b192cafcc94 FOREIGN KEY (candidate_id) REFERENCES public.candidate(id)
);
CREATE TABLE public.employer (
  id integer NOT NULL DEFAULT nextval('employer_id_seq'::regclass),
  user_id integer NOT NULL UNIQUE,
  company_id integer,
  full_name character varying NOT NULL,
  phone_contact character varying,
  avatar_url character varying,
  is_admin_company boolean NOT NULL DEFAULT false,
  status character varying NOT NULL DEFAULT 'active'::character varying,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT employer_pkey PRIMARY KEY (id),
  CONSTRAINT FK_6b1262606e8e48d624fa5557b3e FOREIGN KEY (user_id) REFERENCES public.user(id),
  CONSTRAINT FK_d1754874108e05008a8188abf2c FOREIGN KEY (company_id) REFERENCES public.company(id)
);
CREATE TABLE public.job (
  id integer NOT NULL DEFAULT nextval('job_id_seq'::regclass),
  company_id integer NOT NULL,
  employer_id integer NOT NULL,
  title character varying NOT NULL,
  description text NOT NULL,
  requirements text,
  benefits text,
  salary_min integer,
  salary_max integer,
  currency character varying NOT NULL DEFAULT 'VND'::character varying,
  years_of_experience integer,
  province_id character varying,
  category_id integer,
  job_type_id integer,
  status character varying NOT NULL DEFAULT 'draft'::character varying,
  slots integer,
  deadline timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_pkey PRIMARY KEY (id),
  CONSTRAINT FK_51cb12c924d3e8c7465cc8edff2 FOREIGN KEY (company_id) REFERENCES public.company(id),
  CONSTRAINT FK_b29124ef862925abf6b729236eb FOREIGN KEY (employer_id) REFERENCES public.employer(id),
  CONSTRAINT FK_177da30403318e3e6cf960a1ead FOREIGN KEY (province_id) REFERENCES public.province_metadata(code),
  CONSTRAINT FK_15f44c4b9fbb84e28a0346e930f FOREIGN KEY (category_id) REFERENCES public.job_category_metadata(id),
  CONSTRAINT FK_0e112d0cb745bf1861825dfcec1 FOREIGN KEY (job_type_id) REFERENCES public.job_type_metadata(id)
);
CREATE TABLE public.job_category_metadata (
  id integer NOT NULL DEFAULT nextval('job_category_metadata_id_seq'::regclass),
  name character varying NOT NULL,
  slug character varying NOT NULL UNIQUE,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_category_metadata_pkey PRIMARY KEY (id)
);
CREATE TABLE public.job_skill_tag (
  id integer NOT NULL DEFAULT nextval('job_skill_tag_id_seq'::regclass),
  job_id integer NOT NULL,
  skill_id integer,
  tagText character varying,
  CONSTRAINT job_skill_tag_pkey PRIMARY KEY (id),
  CONSTRAINT FK_22fd397967d8cf550882d819185 FOREIGN KEY (job_id) REFERENCES public.job(id),
  CONSTRAINT FK_ada5b78243b2bf23ff7e175a905 FOREIGN KEY (skill_id) REFERENCES public.skill_metadata(id)
);
CREATE TABLE public.job_type_metadata (
  id integer NOT NULL DEFAULT nextval('job_type_metadata_id_seq'::regclass),
  name character varying NOT NULL,
  slug character varying NOT NULL UNIQUE,
  CONSTRAINT job_type_metadata_pkey PRIMARY KEY (id)
);
CREATE TABLE public.migrations (
  id integer NOT NULL DEFAULT nextval('migrations_id_seq'::regclass),
  timestamp bigint NOT NULL,
  name character varying NOT NULL,
  CONSTRAINT migrations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.project (
  id integer NOT NULL DEFAULT nextval('project_id_seq'::regclass),
  candidate_id integer NOT NULL,
  name character varying NOT NULL,
  start_date date,
  end_date date,
  description text,
  CONSTRAINT project_pkey PRIMARY KEY (id),
  CONSTRAINT FK_28106292f6455e1aa10dc82687c FOREIGN KEY (candidate_id) REFERENCES public.candidate(id)
);
CREATE TABLE public.province_metadata (
  code character varying NOT NULL,
  name character varying NOT NULL,
  slug character varying NOT NULL UNIQUE,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT province_metadata_pkey PRIMARY KEY (code)
);
CREATE TABLE public.skill_metadata (
  id integer NOT NULL DEFAULT nextval('skill_metadata_id_seq'::regclass),
  canonical_name character varying NOT NULL UNIQUE,
  slug character varying NOT NULL UNIQUE,
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  type USER-DEFINED NOT NULL,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT skill_metadata_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user (
  id integer NOT NULL DEFAULT nextval('user_id_seq'::regclass),
  email character varying NOT NULL UNIQUE,
  password character varying NOT NULL,
  role character varying NOT NULL DEFAULT 'candidate'::character varying,
  status character varying NOT NULL DEFAULT 'active'::character varying,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_pkey PRIMARY KEY (id)
);
CREATE TABLE public.work_experience (
  id integer NOT NULL DEFAULT nextval('work_experience_id_seq'::regclass),
  candidate_id integer NOT NULL,
  company_name character varying NOT NULL,
  position character varying NOT NULL,
  start_date date,
  end_date date,
  is_working_here boolean,
  description text,
  CONSTRAINT work_experience_pkey PRIMARY KEY (id),
  CONSTRAINT FK_4d542165035a792e0972754a153 FOREIGN KEY (candidate_id) REFERENCES public.candidate(id)
);
```mermaid
flowchart TD
    subgraph AUTH ["🔐 Supabase Auth"]
        direction TB
        U["<b>auth.users</b><br/>──────────────────────<br/>🔑 <b>id</b> : uuid [PK]<br/>✉️ <b>email</b> : text"]
    end

    subgraph SECURITY ["🗝️ Client-Side Envelope Encryption & Security"]
        direction TB
        UK["<b>public.user_keys</b><br/>──────────────────────────────────────<br/>🔑 <b>user_id</b> : uuid [PK, FK → auth.users]<br/>🧂 <b>salt</b> : text (Argon2id salt for KEK)<br/>🛡️ <b>iv</b> : text (IV for wrapped DEK)<br/>📦 <b>wrapped_dek</b> : text (Ciphertext of DEK)<br/>🛟 <b>recovery_salt</b> : text<br/>🛟 <b>recovery_iv</b> : text<br/>🛟 <b>recovery_wrapped_dek</b> : text<br/>✉️ <b>email</b> : text<br/>🔢 <b>vault_pin_hash</b> : text<br/>🧂 <b>vault_pin_salt</b> : text<br/>⏱️ <b>vault_pin_set_at</b> : timestamptz<br/>⚠️ <b>vault_failed_attempts</b> : int (default 0)<br/>⏱️ <b>vault_last_failed_at</b> : timestamptz<br/>🔒 <b>vault_locked_out</b> : bool (default false)<br/>📅 <b>created_at</b> : timestamptz (default now)<br/>📅 <b>updated_at</b> : timestamptz (default now)"]
    end

    U -->|"1 : 1"| UK

    subgraph DATA ["📦 Encrypted Application Tables (1 : N from User)"]
        direction TB

        subgraph Col1 ["Domain Features (Column 1)"]
            direction TB
            
            T["<b>public.tasks</b><br/>─────────────────────────────<br/>🔑 <b>id</b> : uuid [PK, gen_random_uuid]<br/>👤 <b>user_id</b> : uuid [FK → auth.users]<br/>🛡️ <b>iv</b> : text<br/>📦 <b>data</b> : text (AES-GCM encrypted JSON)<br/>📅 <b>created_at</b> : timestamptz (default now)"]

            N["<b>public.notes</b><br/>─────────────────────────────<br/>🔑 <b>id</b> : uuid [PK, gen_random_uuid]<br/>👤 <b>user_id</b> : uuid [FK → auth.users]<br/>🛡️ <b>iv</b> : text<br/>📦 <b>data</b> : text (AES-GCM encrypted JSON)<br/>📅 <b>created_at</b> : timestamptz (default now)"]

            E["<b>public.expenses</b><br/>─────────────────────────────<br/>🔑 <b>id</b> : uuid [PK, gen_random_uuid]<br/>👤 <b>user_id</b> : uuid [FK → auth.users]<br/>🛡️ <b>iv</b> : text<br/>📦 <b>data</b> : text (AES-GCM encrypted JSON)<br/>📅 <b>created_at</b> : timestamptz (default now)"]

            ED["<b>public.educations</b><br/>─────────────────────────────<br/>🔑 <b>id</b> : uuid [PK, gen_random_uuid]<br/>👤 <b>user_id</b> : uuid [FK → auth.users]<br/>🛡️ <b>iv</b> : text<br/>📦 <b>data</b> : text (AES-GCM encrypted JSON)<br/>📅 <b>created_at</b> : timestamptz (default now)"]

            D["<b>public.documents</b><br/>─────────────────────────────<br/>🔑 <b>id</b> : uuid [PK, gen_random_uuid]<br/>👤 <b>user_id</b> : uuid [FK → auth.users]<br/>🛡️ <b>iv</b> : text<br/>📦 <b>data</b> : text (AES-GCM encrypted JSON)<br/>📅 <b>created_at</b> : timestamptz (default now)"]

            T ~~~ N ~~~ E ~~~ ED ~~~ D
        end

        subgraph Col2 ["Domain Features (Column 2)"]
            direction TB

            MR["<b>public.medical_records</b><br/>─────────────────────────────<br/>🔑 <b>id</b> : uuid [PK, gen_random_uuid]<br/>👤 <b>user_id</b> : uuid [FK → auth.users]<br/>🛡️ <b>iv</b> : text<br/>📦 <b>data</b> : text (AES-GCM encrypted JSON)<br/>📅 <b>created_at</b> : timestamptz (default now)"]

            MC["<b>public.media_collections</b><br/>─────────────────────────────<br/>🔑 <b>id</b> : uuid [PK, gen_random_uuid]<br/>👤 <b>user_id</b> : uuid [FK → auth.users]<br/>🛡️ <b>iv</b> : text<br/>📦 <b>data</b> : text (AES-GCM encrypted JSON)<br/>📅 <b>created_at</b> : timestamptz (default now)"]

            M["<b>public.media</b><br/>─────────────────────────────<br/>🔑 <b>id</b> : uuid [PK, gen_random_uuid]<br/>👤 <b>user_id</b> : uuid [FK → auth.users]<br/>🛡️ <b>iv</b> : text<br/>📦 <b>data</b> : text (AES-GCM encrypted JSON)<br/>📅 <b>created_at</b> : timestamptz (default now)"]

            VE["<b>public.vault_entries</b><br/>─────────────────────────────<br/>🔑 <b>id</b> : uuid [PK, gen_random_uuid]<br/>👤 <b>user_id</b> : uuid [FK → auth.users]<br/>🏷️ <b>section</b> : text ('records'|'passwords'|'banks')<br/>🛡️ <b>iv</b> : text<br/>📦 <b>data</b> : text (AES-GCM encrypted JSON)<br/>📅 <b>created_at</b> : timestamptz (default now)<br/>📅 <b>updated_at</b> : timestamptz (default now)"]

            MR ~~~ MC ~~~ M ~~~ VE
        end
    end

    UK -->|"DEK decrypts data in"| DATA
```

> **Data Architecture Summary:**
> - **Zero-Knowledge Architecture:** Supabase database stores ciphertext only.
> - **Row Shape:** All feature tables share the encrypted envelope pattern (`id`, `user_id`, `iv`, `data`, `created_at`).
> - **`vault_entries` Exception:** Stores plaintext `section` (`records`, `passwords`, `banks`) to permit scoped database filtering without decrypting all vault rows client-side.
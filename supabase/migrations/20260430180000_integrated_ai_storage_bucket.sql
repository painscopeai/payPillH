-- Public bucket for integrated AI uploaded images (URLs returned to the AI proxy).
insert into storage.buckets (id, name, public)
values ('integrated-ai', 'integrated-ai', true)
on conflict (id) do nothing;

create policy "integrated_ai_images_public_read"
on storage.objects for select
to public
using (bucket_id = 'integrated-ai');

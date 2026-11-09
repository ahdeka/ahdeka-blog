-- =====================================================================
-- ⚠️ DEV 전용 (ahdeka-blog-dev). prod DB에서 실행하지 말 것
-- 공개 글마다 0~500 사이 랜덤 조회수를 넣음 (TOP5 확인용). 여러 번 실행하면 값이 다시 섞임
-- 되돌리기: delete from public.post_stats;
-- =====================================================================
insert into public.post_stats (post_id, view_count)
select id, floor(random() * 500)::bigint
from public.posts
where status = 'published'
on conflict (post_id) do update set view_count = excluded.view_count;

-- 확인
select p.number, t.title, s.view_count
from public.post_stats s
join public.posts p on p.id = s.post_id
join public.post_translations t on t.post_id = p.id and t.locale = 'ko'
order by s.view_count desc;

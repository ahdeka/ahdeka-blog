-- =====================================================================
-- ⚠️ DEV 전용 (ahdeka-blog-dev). prod DB에서 실행하지 말 것
-- 목록·페이지네이션·검색 QA용 테스트 글 100개 (공개 98 + 초안 2) + 댓글 + 조회수
--
-- 표시(marker): 한국어 번역의 source_hash = 'seed' (화면에는 안 보임)
--   → 관리 화면에서 시드 글을 수정·저장하면 표시가 사라져 정리 SQL로 지워지지 않음 (그때는 관리 화면에서 삭제)
-- 커버 이미지는 넣지 않음: 실제 글의 이미지를 공유하면 관리 화면에서 시드 글을 지울 때 그 파일까지 삭제됨
-- 카테고리는 기존 것(dev, java-spring, dev-log)을 사용, 태그는 기존 Spring·JPA + 아래 10개를 새로 만듦
-- 다시 넣으려면 dev_seed_cleanup.sql 먼저 실행 (그대로 다시 실행하면 100개가 더 생김)
--
-- 포함된 경우
--   · 제목: 짧은 것 / 두 줄 넘게 긴 것 / 특수문자(% _ " , ( ))
--   · 요약: 있음 / 없음(본문 발췌) / 아주 긴 요약
--   · 본문: 한 문단 ~ 메모 섹션이 여러 개인 긴 글, 코드 블록 유무
--   · 카테고리 없음, 태그 0~4개, 댓글 0개 ~ 30개(답글·작성자 답글·익명 포함)
-- =====================================================================

-- 1. 시드용 태그 (이미 있으면 건너뜀)
insert into public.tags (name, slug) values
  ('Java', 'java'), ('React', 'react'), ('Next.js', 'nextjs'), ('PostgreSQL', 'postgresql'), ('Docker', 'docker'),
  ('TypeScript', 'typescript'), ('Git', 'git'), ('AWS', 'aws'), ('Kotlin', 'kotlin'), ('Linux', 'linux')
on conflict do nothing;

-- 2. 글 · 번역 · 태그 · 조회수 · 댓글
do $$
declare
  -- 주제: 태그 slug / 한국어 / 일본어 / 카테고리 slug
  t_slug text[] := array['java','spring','jpa','react','nextjs','postgresql','docker','typescript','git','aws','kotlin','linux'];
  t_ko   text[] := array['자바','스프링','JPA','리액트','Next.js','PostgreSQL','도커','타입스크립트','Git','AWS','코틀린','리눅스'];
  t_ja   text[] := array['Java','Spring','JPA','React','Next.js','PostgreSQL','Docker','TypeScript','Git','AWS','Kotlin','Linux'];
  t_cat  text[] := array['java-spring','java-spring','java-spring','dev','dev','dev','dev','dev','dev-log','dev','java-spring','dev-log'];

  title_ko text[] := array[
    '%s 트랜잭션 정리',
    '%s 시작하기',
    '%s에서 인덱스가 안 탈 때 확인할 것들',
    '실무에서 %s 쓰면서 배운 점: 목록에서 제목이 두 줄로 잘리는지 확인하기 위해 일부러 길게 쓴 테스트용 제목입니다',
    '%s 배포 삽질기',
    '%s 성능 개선 기록'
  ];
  title_ja text[] := array[
    '%sのトランザクション整理',
    '%s入門',
    '%sでインデックスが効かないときの確認ポイント',
    '実務で%sを使って学んだこと：一覧でタイトルが二行に収まるか確認するため、わざと長くしたテスト用タイトルです',
    '%sデプロイ奮闘記',
    '%sパフォーマンス改善の記録'
  ];

  code_block text := E'```java\n@Transactional(readOnly = true)\npublic List<Post> findRecent(int size) {\n    return postRepository.findTop10ByOrderByPublishedAtDesc();\n}\n```';

  k int;           -- 주제 번호 (1~12)
  v_post uuid;
  v_cat bigint;
  v_status text;
  v_pub timestamptz;
  v_title_ko text; v_title_ja text;
  v_sum_ko text;   v_sum_ja text;
  p1_ko text;      p1_ja text;
  v_body_ko text;  v_body_ja text;
  memo_count int;
  n_comments int;
  c_id uuid;
  j int;
begin
  for i in 1..100 loop
    k := 1 + (i * 7) % 12;

    -- 카테고리: 9번째마다 없음, 4번째마다 개발 로그, 나머지는 주제별
    select id into v_cat from public.categories
      where slug = case when i % 9 = 0 then null when i % 4 = 0 then 'dev-log' else t_cat[k] end;

    -- 초안 2개 (목록·검색·개수에 안 나와야 함)
    v_status := case when i in (13, 57) then 'draft' else 'published' end;
    -- 최신 글부터 약 3일 간격으로 과거로 (100개 ≈ 1년)
    v_pub := case when v_status = 'published' then now() - interval '2 hours' - (i * interval '3 days 7 hours') end;

    -- 제목
    if i = 5 then
      v_title_ko := '100% 커버리지는 필요할까? test_case 네이밍, "따옴표"와 (괄호), 쉼표 검색 테스트';
      v_title_ja := '100%カバレッジは必要？ test_case の命名、"引用符"と(括弧)、カンマ検索テスト';
    elsif i = 8 then
      v_title_ko := 'TIL 🚀';
      v_title_ja := 'TIL 🚀';
    else
      v_title_ko := format(title_ko[1 + i % 6], t_ko[k]);
      v_title_ja := format(title_ja[1 + i % 6], t_ja[k]);
    end if;

    -- 첫 문단 (발췌의 바탕)
    p1_ko := format('이번 글에서는 %s를 실제 프로젝트에 적용하면서 겪은 문제와 해결 과정을 정리합니다. 트랜잭션, 인덱스, 배포 환경 차이처럼 처음에는 사소해 보였던 부분이 의외로 시간을 많이 잡아먹었습니다.', t_ko[k]);
    p1_ja := format('今回は%sを実際のプロジェクトに導入する中で直面した問題と、その解決までの流れをまとめます。トランザクションやインデックス、デプロイ環境の違いなど、最初は些細に見えた部分が意外と時間を取りました。', t_ja[k]);

    -- 요약: 3개 중 1개는 없음(본문 발췌 사용), 10번째마다 아주 긴 요약
    if i % 3 = 0 then
      v_sum_ko := null; v_sum_ja := null;
    elsif i % 10 = 1 then
      v_sum_ko := repeat(format('%s 관련 내용을 길게 요약한 문장입니다. 목록에서 두 줄 이후가 말줄임표로 잘리는지 확인합니다. ', t_ko[k]), 4);
      v_sum_ja := repeat(format('%sに関する内容を長めに要約した文章です。一覧で二行以降が省略記号で切れるか確認します。', t_ja[k]), 4);
    else
      v_sum_ko := format('%s를 쓰면서 헷갈렸던 부분을 정리했습니다.', t_ko[k]);
      v_sum_ja := format('%sを使っていて迷った部分をまとめました。', t_ja[k]);
    end if;

    -- 본문: 메모 섹션 0~7개 → 짧은 글부터 긴 글까지
    memo_count := i % 8;
    v_body_ko := p1_ko || E'\n\n## 배경\n\n'
      || '정리하면서 다시 보니 공식 문서에 이미 답이 있는 경우가 많았습니다. 문제를 만났을 때 바로 검색하기보다 먼저 문서를 읽는 습관을 들이려고 합니다.'
      || case when i % 2 = 0 then E'\n\n## 코드\n\n' || code_block else '' end
      || coalesce((select string_agg(format(E'\n\n## 메모 %s\n\n%s 버전을 올린 뒤에는 설정 파일과 의존성을 꼭 다시 확인해야 합니다. 로컬에서는 문제가 없다가 운영 환경에서만 재현되는 오류가 생각보다 자주 생깁니다.\n\n- 로그 레벨 확인\n- 환경 변수 비교\n- 캐시 초기화', m, t_ko[k]), '') from generate_series(1, memo_count) m), '')
      || E'\n\n## 정리\n\n다음에는 같은 실수를 하지 않도록 체크리스트로 남겨 둡니다.';
    v_body_ja := p1_ja || E'\n\n## 背景\n\n'
      || 'まとめながら見直すと、公式ドキュメントにすでに答えが書いてあることが多かったです。問題にぶつかったら、すぐ検索するより先にドキュメントを読む習慣をつけたいと思います。'
      || case when i % 2 = 0 then E'\n\n## コード\n\n' || code_block else '' end
      || coalesce((select string_agg(format(E'\n\n## メモ %s\n\n%sのバージョンを上げた後は、設定ファイルと依存関係を必ず確認し直す必要があります。ローカルでは問題がないのに、本番環境でだけ再現するエラーが思ったより多いです。\n\n- ログレベルの確認\n- 環境変数の比較\n- キャッシュのクリア', m, t_ja[k]), '') from generate_series(1, memo_count) m), '')
      || E'\n\n## まとめ\n\n次に同じミスをしないよう、チェックリストとして残しておきます。';

    insert into public.posts (category_id, status, published_at)
      values (v_cat, v_status, v_pub)
      returning id into v_post;

    insert into public.post_translations (post_id, locale, title, summary, content, excerpt, source_hash) values
      (v_post, 'ko', v_title_ko, v_sum_ko, v_body_ko,
        case when char_length(p1_ko) > 160 then left(p1_ko, 159) || '…' else p1_ko end, 'seed'),
      (v_post, 'ja', v_title_ja, v_sum_ja, v_body_ja,
        case when char_length(p1_ja) > 160 then left(p1_ja, 159) || '…' else p1_ja end, null);

    -- 태그 0~4개: 주제 태그 + 이어지는 주제 태그 (5번째마다 태그 없음)
    insert into public.post_tags (post_id, tag_id, position)
    select v_post, t.id, s.pos
    from generate_series(0, (i % 5) - 1) as s(pos)
    join public.tags t on t.slug = t_slug[1 + ((k - 1 + s.pos * 3) % 12)]
    on conflict do nothing;

    -- 조회수 0~1999 (TOP5가 시드 글로 바뀔 수 있음)
    if v_status = 'published' then
      insert into public.post_stats (post_id, view_count) values (v_post, floor(random() * 2000)::bigint)
      on conflict (post_id) do update set view_count = excluded.view_count;
    end if;

    -- 댓글: 가장 최신 글은 30개(긴 댓글 목록 확인), 4번째마다 1~5개, 나머지 0개
    n_comments := case when v_status = 'draft' then 0 when i = 1 then 30 when i % 4 = 0 then 1 + i % 5 else 0 end;
    for j in 1..n_comments loop
      insert into public.comments (post_id, nickname, body, created_at)
        values (
          v_post,
          case when j % 3 = 0 then '' else format('방문자%s', j) end, -- '' = 익명
          case when j % 7 = 0
            then repeat('긴 댓글이 줄바꿈되는 모양을 확인하기 위한 문장입니다. ', 8)
            else format('%s 글 잘 읽었습니다. %s번째 댓글이에요.', t_ko[k], j) end,
          least(now(), v_pub + j * interval '3 hours')
        )
        returning id into c_id;
      -- 짝수 번째 댓글에는 작성자 답글, 5의 배수에는 방문자 답글도
      if j % 2 = 0 then
        insert into public.comments (post_id, parent_id, nickname, body, is_author, created_at)
          values (v_post, c_id, 'ahdeka', '읽어 주셔서 감사합니다!', true, least(now(), v_pub + j * interval '3 hours' + interval '1 hour'));
      end if;
      if j % 5 = 0 then
        insert into public.comments (post_id, parent_id, nickname, body, created_at)
          values (v_post, c_id, '지나가던 개발자', '저도 같은 문제 겪었어요.', least(now(), v_pub + j * interval '3 hours' + interval '2 hours'));
      end if;
    end loop;
  end loop;
end $$;

-- 3. 확인: 공개 글 98 / 초안 2 / 시드 댓글 수
select
  count(*) filter (where p.status = 'published') as published,
  count(*) filter (where p.status = 'draft')     as drafts,
  (select count(*) from public.comments c
     join public.post_translations t2 on t2.post_id = c.post_id and t2.locale = 'ko' and t2.source_hash = 'seed') as comments
from public.posts p
join public.post_translations t on t.post_id = p.id and t.locale = 'ko' and t.source_hash = 'seed';

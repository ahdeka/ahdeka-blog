import { AUTHOR_AVATAR } from '@/lib/site';

// 운영자 댓글 표시용 작은 프로필 사진 (방문자 댓글에는 아바타가 없어서 이것만으로 운영자임이 드러남)
// 장식용: 이름과 "작성자" 배지가 바로 옆에 있으므로 alt 비움
export default function AuthorPhoto({ size = 22 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={AUTHOR_AVATAR} alt="" width={size} height={size} className="flex-none rounded-full object-cover" style={{ width: size, height: size }} />
  );
}

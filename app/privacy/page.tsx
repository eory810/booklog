import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보 처리방침 — 리베르홈",
  description: "리베르홈 개인정보 처리방침",
};

const UPDATED = "2026년 9월 15일";

export default function PrivacyPage() {
  return (
    <main className="pv">
      <h1>개인정보 처리방침</h1>
      <p className="upd">최종 업데이트: {UPDATED}</p>

      <p>
        리베르홈(Liberhome, 이하 “앱”)은 이용자의 개인정보를 존중합니다. 본 방침은 앱이 어떤 정보를
        어떻게 다루는지 설명합니다.
      </p>

      <h2>1. 수집·저장하는 정보</h2>
      <p>
        앱은 이용자가 등록한 책 정보(제목·저자·출판사·표지 이미지 주소·상태·메모·별점·분야·대출
        메모 등)를 <b>이용자 본인의 기기에만</b> 저장합니다. 이 데이터는 앱을 만든 사람이나 제3자의
        서버로 전송되거나 수집되지 않습니다. 별도의 회원가입이나 로그인도 없습니다.
      </p>

      <h2>2. 카메라 권한</h2>
      <p>
        바코드 스캔 기능을 위해 카메라 권한을 사용합니다. 카메라는 <b>바코드를 인식하는 순간에만</b>
        쓰이며, 사진이나 영상을 저장하거나 외부로 전송하지 않습니다.
      </p>

      <h2>3. 외부 서비스로 전송되는 정보</h2>
      <p>
        책 정보를 불러오기 위해, 스캔한 도서의 ISBN(책 번호)이 도서 검색 서비스(카카오 책 검색 등)로
        전송됩니다. 이때 전송되는 것은 ISBN뿐이며, 이용자의 개인정보는 포함되지 않습니다.
      </p>
      <p>
        “책장 공유” 기능을 사용하는 경우에 한해, 공유를 누른 시점의 책 목록(제목·저자·출판사·표지·상태·
        분야·별점)이 공유 링크를 만들기 위해 서버에 저장됩니다. 메모와 대출 정보 등 사적인 항목은 공유
        데이터에 <b>포함되지 않습니다</b>. 공유를 사용하지 않으면 어떤 정보도 서버에 저장되지 않습니다.
      </p>

      <h2>4. 데이터 보관과 삭제</h2>
      <p>
        기기에 저장된 데이터는 이용자가 앱을 삭제하거나 앱 데이터를 지우면 함께 삭제됩니다. 앱은 이
        데이터의 별도 사본을 보관하지 않으므로, 필요 시 앱의 백업 기능으로 직접 보관하시기 바랍니다.
      </p>

      <h2>5. 아동의 개인정보</h2>
      <p>앱은 아동을 대상으로 하지 않으며, 개인정보를 수집하지 않습니다.</p>

      <h2>6. 방침의 변경</h2>
      <p>본 방침은 변경될 수 있으며, 변경 시 이 페이지에 업데이트합니다.</p>

      <h2>7. 문의</h2>
      <p>
        개인정보 관련 문의: <a href="mailto:eory810@naver.com">eory810@naver.com</a>
      </p>

      <p className="back">
        <a href="/">← 리베르홈으로 돌아가기</a>
      </p>

      <style>{`
        .pv { max-width: 720px; margin: 0 auto; padding: 40px 20px 80px; font-family: var(--sans, sans-serif); color: #25221b; line-height: 1.7; }
        .pv h1 { font-size: 26px; font-weight: 900; margin-bottom: 6px; }
        .pv .upd { color: #69756d; font-size: 13px; margin-bottom: 24px; }
        .pv h2 { font-size: 17px; font-weight: 800; margin: 26px 0 8px; }
        .pv p { margin-bottom: 10px; font-size: 15px; word-break: keep-all; }
        .pv a { color: #157a42; font-weight: 700; }
        .pv .back { margin-top: 32px; }
      `}</style>
    </main>
  );
}

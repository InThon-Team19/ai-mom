아이맘 부모 일러스트 v2

엄마/아빠 각각 머리 2 × 옷 2 = 총 8조합.
각 조합: neutral, closed, open, wide, round, narrow 완성형 이미지.
normal/small/large는 입 벌림 크기 1.0/0.8/1.2 보정본이다.
앱은 선택한 조합과 보정 단계의 6장만 표시한다. 입 레이어를 런타임 합성하지 않는다.
blink/right PNG는 눈 영역만 담은 독립 오버레이다. 입 영역과 겹치지 않는다.

규격: 512×512 RGBA, 실제 투명 알파. 프레임 간 입 밖 픽셀/알파 동일성 검증.
원본 이미지 및 1024×1024 배포용 48장은 In_Thon/output/imagegen/에 보존했다.
상세 위치/입 앵커/원본 해시는 manifest.json 참조.

프로필: 기존 숫자형 face/hair/eyes/outfit/color를 유지하며 style/portrait를 추가한다.
style=illustration, portrait={version:1,character:mother|father,hair:0|1,outfit:0|1}
style=svg 또는 기존 style 없는 프로필은 원래 SVG 꾸미기를 유지한다.

검증: python scripts/verify-parent-portraits.py (Pillow,numpy 필요)
재생성: python scripts/build-parent-portraits.py --source <원본 imom-parent-custom-v1 폴더>
재생성에는 원본 13장과 기존 assets/parent-2d 파일이 필요하다. 앱 실행에는 모두 포함된 이 폴더만 있으면 된다.

TTS 음소 타임스탬프가 제공되면 기존 driver를 그대로 사용한다.
일반 부모 TTS는 시간/음량/텍스트 기반 근사이며 정확한 음소 정렬이라고 보장하지 않는다.

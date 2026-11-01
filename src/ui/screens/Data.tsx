import { useEffect, useMemo, useRef, useState } from 'react';
import { createBackup, parseBackup, serializeBackup } from '../../domain/backup/backup';
import { buildIcs } from '../../domain/reminders/ics';
import { dailyReminders } from '../../domain/reminders/schedule';
import { copyText, downloadText, isIos, isStandalone, notifyState, requestNotify, type NotifyState } from '../../infra/device';
import { Pill, Section, Toggle } from '../components/bits';
import type { AppStore } from '../store';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

export function DataScreen({ s }: { s: AppStore }) {
  const reminders = useMemo(() => dailyReminders(s.profile), [s.profile]);
  const ics = useMemo(() => buildIcs(reminders, s.today), [reminders, s.today]);
  const [perm, setPerm] = useState<NotifyState>(notifyState());
  const [msg, setMsg] = useState<Record<string, string>>({});
  const note = (k: string, v: string) => setMsg((m) => ({ ...m, [k]: v }));
  const icsRef = useRef<HTMLTextAreaElement>(null);
  const backupRef = useRef<HTMLTextAreaElement>(null);
  const [restoreText, setRestoreText] = useState('');
  const [pending, setPending] = useState<ReturnType<typeof parseBackup> | null>(null);
  const [installEv, setInstallEv] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setInstallEv(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  const backupText = useMemo(() => serializeBackup(createBackup(s.profile, s.realLogs)), [s.profile, s.realLogs]);
  const hasReal = s.realLogs.length > 0;

  const enableNotify = async () => {
    const p = await requestNotify();
    setPerm(p);
    s.setNotifyOn(p === 'granted');
  };

  const stage = (text: string) => {
    setRestoreText(text);
    setPending(text.trim() ? parseBackup(text) : null);
  };

  return (
    <div className="screen">
      <Section title="알림" kicker="복약 마감 · 복약 · 야식 · 저녁 마감">
        <ul className="reminders">
          {reminders.map((r) => (
            <li key={r.id}>
              <span className="mono rem-time">{r.time}</span>
              <span>
                <b>{r.title}</b>
                <span className="muted small rem-body">{r.body}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="honest">
          <p>
            <b>휴대폰 캘린더로 받기가 가장 확실합니다.</b> 이 앱에는 서버가 없어서 앱이 닫혀 있으면 스스로 알림을 보낼 수 없습니다. 캘린더에 매일 반복 일정으로 넣으면 휴대폰이 알아서 울립니다.
          </p>
        </div>

        <div className="stack">
          <button type="button" className="btn btn-primary btn-wide" onClick={() => { downloadText('sungi-diet.ics', ics, 'text/calendar'); note('ics', '내려받기를 시도했습니다. 파일이 안 받아지면 아래 내용을 복사해 sungi-diet.ics 로 저장하세요.'); }}>
            캘린더 파일(.ics) 받기
          </button>
          <p className="muted small">받은 파일을 열고 ‘캘린더에 추가’를 누르세요. 시간대는 기기 시각을 그대로 따릅니다. 복약 시각을 바꾸면 파일을 다시 받아 추가하세요(예전 일정은 캘린더에서 지워야 합니다).</p>
          {msg.ics && <p className="banner banner-info">{msg.ics}</p>}
          <details>
            <summary className="link-summary">파일이 안 받아질 때: 내용 복사</summary>
            <textarea id="ics-text" ref={icsRef} readOnly rows={5} value={ics} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn-small" onClick={async () => note('ics', (await copyText(ics, icsRef.current)) ? '복사했습니다. 메모 앱에 붙여 넣고 sungi-diet.ics 로 저장하세요.' : '복사가 막혀 있어 내용을 선택해 두었습니다. 길게 눌러 복사하세요.')}>
              내용 복사
            </button>
          </details>
        </div>

        <div className="stack">
          <p className="field-label">앱이 열려 있을 때 알림</p>
          {perm === 'unsupported' && <p className="banner banner-hold">이 환경에서는 브라우저 알림을 쓸 수 없습니다. 캘린더 알림을 쓰세요.</p>}
          {perm === 'denied' && <p className="banner banner-hold">알림이 차단되어 있습니다. 브라우저·휴대폰 설정에서 이 사이트의 알림을 허용한 뒤 다시 시도하세요.</p>}
          {(perm === 'default' || perm === 'granted') && (
            <>
              {perm === 'default' ? (
                <button type="button" className="btn btn-wide" onClick={enableNotify}>
                  앱 알림 허용하기
                </button>
              ) : (
                <Toggle id="notify-on" checked={s.notifyOn} onChange={s.setNotifyOn} label="앱이 열려 있을 때 알림 받기" hint="앱을 닫거나 화면이 꺼지면 울리지 않을 수 있습니다" />
              )}
            </>
          )}
          {isIos() && !isStandalone() && <p className="banner banner-hold">iPhone은 Safari 공유 버튼 → ‘홈 화면에 추가’로 설치한 뒤에만 알림을 쓸 수 있습니다.</p>}
        </div>
      </Section>

      <Section title="홈 화면에 설치" kicker="오프라인에서도 열립니다">
        {isStandalone() ? (
          <p>
            <Pill tone="take">설치됨</Pill> 홈 화면에서 열고 있습니다.
          </p>
        ) : installEv ? (
          <button type="button" className="btn btn-primary btn-wide" onClick={() => void installEv.prompt()}>
            앱으로 설치
          </button>
        ) : (
          <p className="muted">
            {isIos()
              ? 'Safari 공유 버튼 → ‘홈 화면에 추가’를 누르세요.'
              : '브라우저 메뉴(⋮) → ‘홈 화면에 추가’ 또는 ‘앱 설치’를 누르세요. 이 화면이 앱 안에 열려 있거나 이미 설치했다면 버튼이 나오지 않습니다.'}
          </p>
        )}
      </Section>

      <Section title="백업과 복원" kicker="기록은 이 기기에만 있습니다">
        <p className="muted small">로그인이 없어서 휴대폰을 바꾸거나 브라우저 데이터를 지우면 기록이 사라집니다. 가끔 백업해 두세요.</p>
        {!hasReal && <p className="banner banner-info">아직 저장한 기록이 없습니다(지금 보이는 14일은 예시). 설정은 그대로 백업됩니다.</p>}
        <div className="stack">
          <button type="button" className="btn btn-primary btn-wide" onClick={() => { downloadText(`sungi-backup-${s.today}.json`, backupText, 'application/json'); note('bk', '내려받기를 시도했습니다. 안 받아지면 아래 내용을 복사해 두세요.'); }}>
            백업 파일 받기
          </button>
          {msg.bk && <p className="banner banner-info">{msg.bk}</p>}
          <details>
            <summary className="link-summary">파일이 안 받아질 때: 내용 복사</summary>
            <textarea id="backup-text" ref={backupRef} readOnly rows={5} value={backupText} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn-small" onClick={async () => note('bk', (await copyText(backupText, backupRef.current)) ? '복사했습니다. 메모 앱 등에 붙여 두세요.' : '복사가 막혀 있어 내용을 선택해 두었습니다. 길게 눌러 복사하세요.')}>
              내용 복사
            </button>
          </details>
        </div>

        <div className="stack restore">
          <p className="field-label">복원</p>
          <input
            id="restore-file"
            type="file"
            accept="application/json,.json"
            aria-label="백업 파일 선택"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) stage(await f.text());
              e.target.value = '';
            }}
          />
          <label className="field" htmlFor="restore-text">
            <span className="field-label">또는 백업 내용을 붙여 넣기</span>
            <textarea id="restore-text" rows={4} value={restoreText} onChange={(e) => stage(e.target.value)} placeholder='{ "app": "sungi-diet", ... }' />
          </label>
          {pending && !pending.ok && <p className="banner banner-skip" role="alert">{pending.error}</p>}
          {pending?.ok && (
            <div className="banner banner-info stack-tight">
              <span>
                기록 <b>{pending.logs.length}일</b>과 설정(체질 {pending.profile.constitution}, 약 {pending.profile.autonomicStatus.medications.length}개)을 불러옵니다.{' '}
                <b>지금 저장된 설정과 기록은 이 내용으로 바뀝니다.</b>
              </span>
              {pending.warnings.map((w) => (
                <span key={w} className="small">⚠ {w}</span>
              ))}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  s.replaceData(pending.profile, pending.logs);
                  setPending(null);
                  setRestoreText('');
                  note('restore', `복원했습니다. 기록 ${pending.logs.length}일`);
                }}
              >
                이 내용으로 복원
              </button>
            </div>
          )}
          {msg.restore && <p className="banner banner-take">{msg.restore}</p>}
        </div>
      </Section>
    </div>
  );
}

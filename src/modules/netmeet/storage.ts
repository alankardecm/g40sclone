import { isSupabaseConfigured, getSupabaseAdmin } from '@/lib/supabase';
import { getMysqlPool } from '@/infrastructure/datalake/mysql-client';
import type { RowDataPacket } from 'mysql2';

export type NetMeetActionItem = {
  owner: string;
  task: string;
  due_date?: string | null;
  status: string;
};

export type NetMeetMeeting = {
  id: string;
  title: string;
  meetingLink: string;
  classification: string;
  transcript: string;
  summary: string;
  decisions: string[];
  risks: string[];
  nextSteps: string[];
  actionItems: NetMeetActionItem[];
  provider: string;
  publishedToTeams: boolean;
  createdAt: string;
  updatedAt: string;
  // Identificação do usuário (WhatsApp → Azure AD)
  userEmail?: string;
  senderPhone?: string;
  senderName?: string;
  // Campos de integração com NetMeeting Bot (Teams)
  externalId?: string;
  meetingDate?: string;
  recipients?: string[];
};

interface NetMeetMeetingRow {
  id: string;
  title: string;
  meeting_link: string;
  classification: string;
  transcript: string;
  summary: string;
  decisions: string[] | string;
  risks: string[] | string;
  next_steps: string[] | string;
  action_items: NetMeetActionItem[] | string;
  provider: string;
  published_to_teams: boolean;
  user_email?: string | null;
  sender_phone?: string | null;
  sender_name?: string | null;
  created_at: string;
  updated_at: string;
  external_id?: string | null;
  meeting_date?: string | null;
  recipients?: string[] | string | null;
}

function parseJsonField<T>(field: any): T {
  if (!field) return [] as any;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field) as T;
    } catch {
      return [] as any;
    }
  }
  return field as T;
}

function mapRowToMeeting(row: NetMeetMeetingRow): NetMeetMeeting {
  return {
    id: row.id,
    title: row.title,
    meetingLink: row.meeting_link || '',
    classification: row.classification,
    transcript: row.transcript,
    summary: row.summary,
    decisions: parseJsonField<string[]>(row.decisions),
    risks: parseJsonField<string[]>(row.risks),
    nextSteps: parseJsonField<string[]>(row.next_steps),
    actionItems: parseJsonField<NetMeetActionItem[]>(row.action_items),
    provider: row.provider,
    publishedToTeams: !!row.published_to_teams,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
    userEmail: row.user_email || undefined,
    senderPhone: row.sender_phone || undefined,
    senderName: row.sender_name || undefined,
    externalId: row.external_id || undefined,
    meetingDate: row.meeting_date || undefined,
    recipients: parseJsonField<string[]>(row.recipients),
  };
}

function mapMeetingToRow(meeting: NetMeetMeeting) {
  return {
    id: meeting.id,
    title: meeting.title,
    meeting_link: meeting.meetingLink,
    classification: meeting.classification,
    transcript: meeting.transcript,
    summary: meeting.summary,
    decisions: meeting.decisions,
    risks: meeting.risks,
    next_steps: meeting.nextSteps,
    action_items: meeting.actionItems,
    provider: meeting.provider,
    published_to_teams: meeting.publishedToTeams,
    user_email: meeting.userEmail || null,
    sender_phone: meeting.senderPhone || null,
    sender_name: meeting.senderName || null,
    created_at: meeting.createdAt,
    updated_at: meeting.updatedAt,
  };
}

export async function readMeetings(): Promise<NetMeetMeeting[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('netmeet_meetings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error reading meetings from Supabase:', error);
      return [];
    }

    return (data || []).map(mapRowToMeeting);
  } else {
    try {
      const pool = getMysqlPool();
      const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM os_meetings ORDER BY created_at DESC');
      return (rows || []).map((row) => mapRowToMeeting(row as any));
    } catch (err) {
      console.error('Error reading meetings from MySQL:', err);
      return [];
    }
  }
}

export async function createMeeting(input: {
  title: string;
  meetingLink: string;
  classification: string;
}) {
  const now = new Date().toISOString();
  const id = `${Date.now()}`;

  const meetingRow = {
    id,
    title: input.title.trim() || 'Reunião sem título',
    meeting_link: input.meetingLink.trim(),
    classification: input.classification.trim() || 'interno',
    transcript: '',
    summary: '',
    decisions: [] as string[],
    risks: [] as string[],
    next_steps: [] as string[],
    action_items: [] as NetMeetActionItem[],
    provider: 'pending',
    published_to_teams: false,
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('netmeet_meetings')
      .insert(meetingRow);

    if (error) {
      console.error('Error creating meeting in Supabase:', error);
    }
  } else {
    try {
      const pool = getMysqlPool();
      await pool.query(
        `INSERT INTO os_meetings (id, title, meeting_link, classification, transcript, summary, decisions, risks, next_steps, action_items, provider, published_to_teams, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, meetingRow.title, meetingRow.meeting_link, meetingRow.classification, 
          meetingRow.transcript, meetingRow.summary, JSON.stringify(meetingRow.decisions),
          JSON.stringify(meetingRow.risks), JSON.stringify(meetingRow.next_steps), 
          JSON.stringify(meetingRow.action_items), meetingRow.provider, meetingRow.published_to_teams,
          new Date(now), new Date(now)
        ]
      );
    } catch (err) {
      console.error('Error creating meeting in MySQL:', err);
    }
  }

  return mapRowToMeeting(meetingRow);
}

export async function updateMeeting(meetingId: string, updater: (meeting: NetMeetMeeting) => NetMeetMeeting) {
  const current = await getMeeting(meetingId);
  if (!current) {
    throw new Error(`Reunião ${meetingId} não encontrada.`);
  }

  const updated = {
    ...updater(current),
    updatedAt: new Date().toISOString(),
  };

  const row = mapMeetingToRow(updated);

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('netmeet_meetings')
      .update(row)
      .eq('id', meetingId);

    if (error) {
      console.error('Error updating meeting in Supabase:', error);
    }
  } else {
    try {
      const pool = getMysqlPool();
      await pool.query(
        `UPDATE os_meetings 
         SET title=?, meeting_link=?, classification=?, transcript=?, summary=?, decisions=?, risks=?, next_steps=?, action_items=?, provider=?, published_to_teams=?, user_email=?, sender_phone=?, sender_name=?, updated_at=?
         WHERE id=?`,
        [
          row.title, row.meeting_link, row.classification, row.transcript, row.summary, 
          JSON.stringify(row.decisions), JSON.stringify(row.risks), JSON.stringify(row.next_steps), 
          JSON.stringify(row.action_items), row.provider, row.published_to_teams, row.user_email, 
          row.sender_phone, row.sender_name, new Date(updated.updatedAt), meetingId
        ]
      );
    } catch (err) {
      console.error('Error updating meeting in MySQL:', err);
    }
  }

  return updated;
}

export async function getMeeting(meetingId: string): Promise<NetMeetMeeting | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('netmeet_meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (error || !data) return null;
    return mapRowToMeeting(data);
  } else {
    try {
      const pool = getMysqlPool();
      const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM os_meetings WHERE id = ?', [meetingId]);
      if (rows.length === 0) return null;
      return mapRowToMeeting(rows[0] as any);
    } catch (err) {
      console.error('Error getting meeting from MySQL:', err);
      return null;
    }
  }
}

export async function upsertMeetingFromBot(input: {
  externalId: string;
  title: string;
  meetingDate: string;
  organizerEmail: string;
  organizerName: string;
  meetingLink: string;
  summary: string;
  decisions: string[];
  risks: string[];
  nextSteps: string[];
  actionItems: NetMeetActionItem[];
  provider: string;
  recipientEmail: string;
}): Promise<NetMeetMeeting> {
  const recipient = input.recipientEmail.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from('netmeet_meetings')
      .select('*')
      .eq('external_id', input.externalId)
      .maybeSingle();

    if (existing) {
      const recipients: string[] = existing.recipients || [];
      if (!recipients.includes(recipient)) {
        recipients.push(recipient);
      }
      const updated = {
        title: input.title,
        summary: input.summary,
        decisions: input.decisions,
        risks: input.risks,
        next_steps: input.nextSteps,
        action_items: input.actionItems,
        provider: input.provider,
        meeting_link: input.meetingLink || existing.meeting_link,
        meeting_date: input.meetingDate || existing.meeting_date,
        sender_name: input.organizerName || existing.sender_name,
        user_email: input.organizerEmail || existing.user_email,
        recipients,
        updated_at: new Date().toISOString(),
      };
      const { error: updateError } = await supabase
        .from('netmeet_meetings')
        .update(updated)
        .eq('external_id', input.externalId);
      if (updateError) {
        console.error('Error updating meeting from bot in Supabase:', updateError);
        throw new Error(`Falha ao atualizar reunião do bot: ${updateError.message}`);
      }
      return mapRowToMeeting({ ...existing, ...updated });
    }

    const now = new Date().toISOString();
    const id = `teams_${Date.now()}`;

    const row: NetMeetMeetingRow = {
      id,
      title: input.title,
      meeting_link: input.meetingLink,
      classification: 'teams-summary',
      transcript: '',
      summary: input.summary,
      decisions: input.decisions,
      risks: input.risks,
      next_steps: input.nextSteps,
      action_items: input.actionItems,
      provider: input.provider,
      published_to_teams: false,
      user_email: input.organizerEmail,
      sender_phone: null,
      sender_name: input.organizerName,
      external_id: input.externalId,
      meeting_date: input.meetingDate,
      recipients: [recipient],
      created_at: now,
      updated_at: now,
    };

    const { error: insertError } = await supabase.from('netmeet_meetings').insert(row);
    if (insertError) {
      console.error('Error inserting meeting from bot in Supabase:', insertError);
      throw new Error(`Falha ao inserir reunião do bot: ${insertError.message}`);
    }
    return mapRowToMeeting(row);
  } else {
    try {
      const pool = getMysqlPool();
      const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM os_meetings WHERE external_id = ?', [input.externalId]);
      const existing = rows[0];

      if (existing) {
        const recipients: string[] = parseJsonField<string[]>(existing.recipients) || [];
        if (!recipients.includes(recipient)) {
          recipients.push(recipient);
        }
        const nowStr = new Date().toISOString();
        await pool.query(
          `UPDATE os_meetings 
           SET title=?, summary=?, decisions=?, risks=?, next_steps=?, action_items=?, provider=?, meeting_link=?, meeting_date=?, sender_name=?, user_email=?, recipients=?, updated_at=?
           WHERE external_id=?`,
          [
            input.title, input.summary, JSON.stringify(input.decisions), JSON.stringify(input.risks), 
            JSON.stringify(input.nextSteps), JSON.stringify(input.actionItems), input.provider,
            input.meetingLink || existing.meeting_link, input.meetingDate || existing.meeting_date,
            input.organizerName || existing.sender_name, input.organizerEmail || existing.user_email,
            JSON.stringify(recipients), new Date(nowStr), input.externalId
          ]
        );
        return mapRowToMeeting({ ...existing, recipients, title: input.title, summary: input.summary, decisions: input.decisions, risks: input.risks, next_steps: input.nextSteps, action_items: input.actionItems, provider: input.provider, updated_at: nowStr } as any);
      }

      const now = new Date().toISOString();
      const id = `teams_${Date.now()}`;

      await pool.query(
        `INSERT INTO os_meetings (id, title, meeting_link, classification, transcript, summary, decisions, risks, next_steps, action_items, provider, published_to_teams, user_email, sender_phone, sender_name, external_id, meeting_date, recipients, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
        [
          id, input.title, input.meetingLink, 'teams-summary', '', input.summary,
          JSON.stringify(input.decisions), JSON.stringify(input.risks), JSON.stringify(input.nextSteps),
          JSON.stringify(input.actionItems), input.provider, false, input.organizerEmail,
          input.organizerName, input.externalId, input.meetingDate, JSON.stringify([recipient]),
          new Date(now), new Date(now)
        ]
      );

      return mapRowToMeeting({
        id,
        title: input.title,
        meeting_link: input.meetingLink,
        classification: 'teams-summary',
        transcript: '',
        summary: input.summary,
        decisions: input.decisions,
        risks: input.risks,
        next_steps: input.nextSteps,
        action_items: input.actionItems,
        provider: input.provider,
        published_to_teams: false,
        user_email: input.organizerEmail,
        sender_phone: null,
        sender_name: input.organizerName,
        external_id: input.externalId,
        meeting_date: input.meetingDate,
        recipients: [recipient],
        created_at: now,
        updated_at: now,
      });
    } catch (err: any) {
      console.error('Error upserting meeting from bot in MySQL:', err);
      throw new Error(`Falha ao inserir reunião do bot no MySQL: ${err.message}`);
    }
  }
}

import { useEffect, useState, useMemo } from "react";
import { ScrollView, Text, View, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import Markdown from "react-native-markdown-display";
import { BackChip, Icon, Pressy, Surface } from "@zijinhua/app-sdk/ui";
import { themedStyleSheet, useTheme } from "@zijinhua/app-sdk/ui";
import { getAppContext } from "@zijinhua/app-sdk";
import { type Note, readNotes, subscribeNotes, writeNotes } from "./storage";

function askShell(request: { action: "back" }) {
  getAppContext().navigation.back();
}

function NotepadApp() {
  const { colors, mode } = useTheme();
  const [notes, setNotes] = useState<Note[]>(() => readNotes());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);

  useEffect(() => subscribeNotes(setNotes), []);

  const formatDate = (ms: number) => {
    const date = new Date(ms);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

  const saveNote = () => {
    if (!title.trim() && !content.trim()) {
      setEditingId(null);
      return;
    }
    const currentNotes = readNotes();
    if (editingId && editingId !== "new") {
      const updated = currentNotes.map(n => n.id === editingId ? { ...n, title, content, updatedAt: Date.now() } : n);
      writeNotes(updated);
    } else {
      const newNote: Note = {
        id: Date.now().toString(),
        title,
        content,
        updatedAt: Date.now()
      };
      writeNotes([newNote, ...currentNotes]);
    }
    setEditingId(null);
  };

  const deleteNote = (id: string) => {
    const currentNotes = readNotes();
    writeNotes(currentNotes.filter(n => n.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const openEditor = (note?: Note) => {
    if (note) {
      setEditingId(note.id);
      setTitle(note.title);
      setContent(note.content);
    } else {
      setEditingId("new");
      setTitle("");
      setContent("");
    }
    setPreview(false);
  };

  const markdownStyle = useMemo(() => ({
    body: { color: colors.ink1, fontSize: 16, lineHeight: 24 },
    heading1: { color: colors.ink1, fontFamily: colors.serif, marginTop: 16, marginBottom: 8 },
    heading2: { color: colors.ink1, fontFamily: colors.serif, marginTop: 16, marginBottom: 8 },
    code_inline: { backgroundColor: colors.inset, color: colors.ink1, borderRadius: 4, padding: 2 },
    code_block: { backgroundColor: colors.inset, color: colors.ink1, padding: 8, borderRadius: 8 },
    fence: { backgroundColor: colors.inset, color: colors.ink1, padding: 8, borderRadius: 8 },
    link: { color: colors.orchid },
  }), [colors]);

  if (editingId) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
        <View style={styles.bar}>
          <BackChip onPress={() => {
            saveNote();
          }} />
          <View style={styles.barCopy}>
            <Text style={[styles.barTitle, { color: colors.ink1 }]}>{preview ? "预览" : "编辑笔记"}</Text>
          </View>
          <View style={styles.actions}>
            <Pressy
              accessibilityRole="button"
              onPress={() => setPreview(!preview)}
              scale={0.9}
              style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: preview ? colors.orchid : colors.line }]}
            >
              <Icon name="info" size={18} color={preview ? colors.orchid : colors.ink1} strokeWidth={2} />
            </Pressy>
            {editingId !== "new" && (
              <Pressy
                accessibilityRole="button"
                onPress={() => deleteNote(editingId)}
                scale={0.9}
                style={[styles.iconButton, { backgroundColor: colors.surface }]}
              >
                <Icon name="close" size={18} color={colors.danger} strokeWidth={2} />
              </Pressy>
            )}
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.editorContent} showsVerticalScrollIndicator={false}>
          {preview ? (
            <View style={styles.previewContainer}>
              {title ? <Text style={[styles.previewTitle, { color: colors.ink1 }]}>{title}</Text> : null}
              <Markdown style={markdownStyle}>{content || "暂无内容"}</Markdown>
            </View>
          ) : (
            <View style={styles.editorForm}>
              <TextInput
                style={[styles.titleInput, { color: colors.ink1, borderBottomColor: colors.line }]}
                placeholder="笔记标题"
                placeholderTextColor={colors.ink3}
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={[styles.contentInput, { color: colors.ink1 }]}
                placeholder="开始书写 (支持 Markdown)..."
                placeholderTextColor={colors.ink3}
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
              />
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <View style={styles.bar}>
        <BackChip onPress={() => askShell({ action: "back" })} />
        <View style={styles.barCopy}>
          <Text style={[styles.barTitle, { color: colors.ink1 }]}>记事本</Text>
        </View>
        <Pressy
          accessibilityRole="button"
          onPress={() => openEditor()}
          scale={0.9}
          style={[styles.iconButton, { backgroundColor: colors.surface }]}
        >
          <Icon name="plus" size={18} color={colors.ink1} strokeWidth={2} />
        </Pressy>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {notes.length === 0 ? (
          <Surface tone="inset" style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.ink3 }]}>还没有记录，点击右上角新建。</Text>
          </Surface>
        ) : (
          <View style={styles.list}>
            {notes.map((note) => (
              <TouchableOpacity key={note.id} activeOpacity={0.7} onPress={() => openEditor(note)}>
                <Surface tone="raised" style={styles.card}>
                  <Text style={[styles.cardTitle, { color: colors.ink1 }]} numberOfLines={1}>
                    {note.title || "无标题"}
                  </Text>
                  <Text style={[styles.cardContent, { color: colors.ink2 }]} numberOfLines={2}>
                    {note.content || "..."}
                  </Text>
                  <Text style={[styles.cardDate, { color: colors.ink3 }]}>{formatDate(note.updatedAt)}</Text>
                </Surface>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = themedStyleSheet((t) => ({
  screen: {
    flex: 1,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  barCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  barTitle: {
    fontFamily: t.serif,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.line,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 36,
    gap: 16,
  },
  empty: {
    padding: 32,
    alignItems: "center",
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
  },
  list: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardDate: {
    fontSize: 11,
    marginTop: 4,
  },
  editorContent: {
    flexGrow: 1,
  },
  editorForm: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  titleInput: {
    fontFamily: t.serif,
    fontSize: 24,
    fontWeight: "700",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 300,
  },
  previewContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  previewTitle: {
    fontFamily: t.serif,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
  },
}));

export default NotepadApp;

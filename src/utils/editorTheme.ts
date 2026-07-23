import {
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const appHighlightStyle = HighlightStyle.define([
  {
    tag: [
      tags.comment,
      tags.lineComment,
      tags.blockComment,
      tags.docComment,
    ],
    color: "var(--syntax-comment)",
    fontStyle: "italic",
  },
  {
    tag: [
      tags.keyword,
      tags.modifier,
      tags.operatorKeyword,
      tags.controlKeyword,
    ],
    color: "var(--syntax-keyword)",
  },
  {
    tag: [
      tags.string,
      tags.special(tags.string),
      tags.regexp,
      tags.character,
    ],
    color: "var(--syntax-string)",
  },
  {
    tag: [
      tags.number,
      tags.bool,
      tags.null,
      tags.atom,
    ],
    color: "var(--syntax-number)",
  },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.definition(tags.function(tags.variableName)),
    ],
    color: "var(--syntax-function)",
  },
  {
    tag: [
      tags.variableName,
      tags.definition(tags.variableName),
      tags.constant(tags.variableName),
    ],
    color: "var(--syntax-variable)",
  },
  {
    tag: [
      tags.typeName,
      tags.className,
      tags.namespace,
      tags.typeOperator,
    ],
    color: "var(--syntax-type)",
  },
  {
    tag: tags.tagName,
    color: "var(--syntax-tag)",
  },
  {
    tag: [
      tags.attributeName,
      tags.propertyName,
    ],
    color: "var(--syntax-attribute)",
  },
  {
    tag: [
      tags.meta,
    ],
    color: "var(--syntax-meta)",
  },
  {
    tag: tags.deleted,
    color: "var(--syntax-invalid)",
  },
]);

export function createEditorTheme(): Extension {
  return [
    syntaxHighlighting(appHighlightStyle),
    EditorView.theme({
      "&": {
        color: "var(--text)",
        backgroundColor: "var(--editor-bg)",
      },
      ".cm-gutters": {
        color: "var(--text-muted)",
        backgroundColor: "var(--editor-gutter)",
        borderRightColor: "var(--border)",
      },
      ".cm-cursor": {
        borderLeftColor: "var(--primary)",
      },
      ".cm-selectionBackground, ::selection": {
        backgroundColor: "var(--primary)",
      },
      ".cm-activeLine": {
        backgroundColor: "var(--surface-hover)",
      },
      ".cm-matchingBracket, .cm-nonmatchingBracket": {
        backgroundColor: "var(--surface-hover)",
        outline: "none",
      },
      ".cm-foldGutter": {
        backgroundColor: "var(--editor-gutter)",
        borderRightColor: "var(--border)",
      },
    }),
  ];
}
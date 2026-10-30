/** JSON-only Slate schema, shared by browser editors and the live server.
 * Business nodes keep legacy attributes as top-level properties and htmlAttributes.
 * html_opaque is a block void; html_opaque_inline is an inline void. Both retain
 * sanitized HTML in `html`; renderers must register both types as void nodes.
 * Lists use Plate's flat p + indent/listStyleType/listRestart/checked model.
 */
export type SlateText = { text: string; [key: string]: unknown };
export type SlateElement = { type: string; children: SlateNode[]; [key: string]: unknown };
export type SlateNode = SlateText | SlateElement;
export type SlateValue = SlateElement[];

import { sheets } from '@/app/grid/controller/Sheets';
import { insertCellRef } from '@/app/ui/menus/CodeEditor/insertCellRef';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { hasPermissionToEditFile } from '../../../actions';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';

export function keyboardCode(
  event: React.KeyboardEvent<HTMLElement>,
  editorInteractionState: EditorInteractionState
): boolean {
  if (!hasPermissionToEditFile(editorInteractionState.permissions)) {
    return false;
  }
  if (event.code === 'Enter' && (event.ctrlKey || event.metaKey)) {
    if (event.shiftKey) {
      if (event.altKey) {
        quadraticCore.rerunCodeCells(sheets.sheet.id, undefined, undefined, sheets.getCursorPosition());
      } else {
        quadraticCore.rerunCodeCells(undefined, undefined, undefined, sheets.getCursorPosition());
      }
    } else {
      quadraticCore.rerunCodeCells(
        sheets.sheet.id,
        editorInteractionState.selectedCell.x,
        editorInteractionState.selectedCell.y,
        sheets.getCursorPosition()
      );
    }
    event.preventDefault();
    return true;
  }

  if (editorInteractionState.showCodeEditor) {
    if (event.code === 'KeyL' && (event.ctrlKey || event.metaKey)) {
      insertCellRef(editorInteractionState);
      event.preventDefault();
    }
  }
  return false;
}

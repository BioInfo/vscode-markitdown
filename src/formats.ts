// The one list of file extensions the extension converts (no vscode import,
// so plain-Node tests can check it against package.json's menu clause).
export const SUPPORTED_EXTENSIONS: readonly string[] = [
    'pdf', 'docx', 'pptx', 'xlsx', 'xls', 'html', 'htm', 'csv', 'json', 'xml',
    'epub', 'ipynb', 'msg', 'png', 'jpg', 'jpeg', 'gif', 'mp3', 'wav', 'm4a', 'zip'
];

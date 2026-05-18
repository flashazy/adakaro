import 'dart:io';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/errors/load_error_mapper.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/teacher_ui_tokens.dart';
import '../../data/models/teacher_models.dart';
import '../../data/teacher_repository.dart';

const int _maxDocumentBytes = 10 * 1024 * 1024;
const int _quotaBytes = 100 * 1024 * 1024;

const _allCategories = <String>[
  'Certificates',
  'CV/Resume',
  'Lesson Plans',
  'Training',
  'Administrative',
  'Personal',
  'Other',
];

/// Suggests a document category from the picked file name (teacher can override).
String suggestDocumentCategoryFromFileName(String fileName) {
  final n = fileName.toLowerCase();
  if (n.contains('lesson') ||
      n.contains('lesson-plan') ||
      n.contains('lesson_plan') ||
      n.contains('plan')) {
    return 'Lesson Plans';
  }
  if (n.contains('cv') || n.contains('resume')) {
    return 'CV/Resume';
  }
  if (n.contains('certificate') || n.contains('cert')) {
    return 'Certificates';
  }
  if (n.contains('training') || n.contains('course')) {
    return 'Training';
  }
  return 'Other';
}

IconData _categoryIcon(String category) {
  return switch (category) {
    'Certificates' => Icons.workspace_premium_rounded,
    'CV/Resume' => Icons.contact_page_rounded,
    'Lesson Plans' => Icons.menu_book_rounded,
    'Training' => Icons.psychology_rounded,
    'Administrative' => Icons.business_center_rounded,
    'Personal' => Icons.person_outline_rounded,
    _ => Icons.folder_outlined,
  };
}

String? _mimeFromExtension(String extRaw) {
  final e = extRaw.toLowerCase().replaceFirst('.', '');
  return switch (e) {
    'pdf' => 'application/pdf',
    'doc' => 'application/msword',
    'docx' =>
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'jpg' || 'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    _ => null,
  };
}

String _formatBytes(int? n) {
  if (n == null || n <= 0) return '—';
  if (n < 1024) return '$n B';
  if (n < 1024 * 1024) return '${(n / 1024).toStringAsFixed(1)} KB';
  return '${(n / (1024 * 1024)).toStringAsFixed(2)} MB';
}

/// Storage meter always shows megabytes with two decimals (web parity).
String _formatStorageMb(int bytes) =>
    '${(bytes / (1024 * 1024)).toStringAsFixed(2)} MB';

String _fileExtensionForDoc(TeacherDocumentRow doc) {
  final dot = doc.documentName.lastIndexOf('.');
  if (dot >= 0 && dot < doc.documentName.length - 1) {
    final ext = doc.documentName.substring(dot + 1).trim().toLowerCase();
    if (ext.isNotEmpty && ext.length <= 8) return ext;
  }
  return switch (_previewKind(doc.fileType)) {
    _DocPreviewKind.pdf => 'pdf',
    _DocPreviewKind.image =>
      doc.fileType.contains('png') ? 'png' : 'jpg',
    _DocPreviewKind.other => _isWordMime(doc.fileType)
        ? (doc.fileType.contains('openxml') ? 'docx' : 'doc')
        : 'bin',
  };
}

String _formatStoragePercentUsed(int usedBytes, int quotaBytes) {
  if (usedBytes <= 0 || quotaBytes <= 0) return '0';
  final pct = (usedBytes / quotaBytes) * 100;
  final clamped = pct.clamp(0.0, 100.0);
  if (clamped < 1) return clamped.toStringAsFixed(2);
  return clamped.toStringAsFixed(1);
}

String _formatUploadedDate(String iso) {
  final dt = DateTime.tryParse(iso);
  if (dt == null) return iso;
  return DateFormat('d MMM yyyy').format(dt.toLocal());
}

enum _DocPreviewKind { image, pdf, other }

_DocPreviewKind _previewKind(String mime) {
  final t = mime.trim().toLowerCase();
  if (t == 'image/jpeg' || t == 'image/png') return _DocPreviewKind.image;
  if (t == 'application/pdf') return _DocPreviewKind.pdf;
  return _DocPreviewKind.other;
}

IconData _fileTypeIcon(TeacherDocumentRow doc) {
  return switch (_previewKind(doc.fileType)) {
    _DocPreviewKind.pdf => Icons.picture_as_pdf_rounded,
    _DocPreviewKind.image => Icons.image_rounded,
    _DocPreviewKind.other => switch (doc.fileType) {
        'application/msword' ||
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' =>
          Icons.article_rounded,
        _ => Icons.insert_drive_file_outlined,
      },
  };
}

bool _isWordMime(String mime) {
  final t = mime.trim().toLowerCase();
  return t == 'application/msword' ||
      t ==
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

({Color bg, Color fg}) _thumbnailTint(String fileType) {
  final kind = _previewKind(fileType);
  if (kind == _DocPreviewKind.pdf) {
    return (bg: const Color(0xFFFEF2F2), fg: const Color(0xFFB91C1C));
  }
  if (kind == _DocPreviewKind.image) {
    return (bg: const Color(0xFFEFF6FF), fg: const Color(0xFF3B82F6));
  }
  if (_isWordMime(fileType)) {
    return (bg: const Color(0xFFEEF2FF), fg: const Color(0xFF4F46E5));
  }
  return (bg: const Color(0xFFF8FAFC), fg: const Color(0xFF64748B));
}

class TeacherDocumentsScreen extends StatefulWidget {
  const TeacherDocumentsScreen({
    super.key,
    required this.user,
    required this.data,
  });

  final User user;
  final TeacherDeskData data;

  @override
  State<TeacherDocumentsScreen> createState() =>
      _TeacherDocumentsScreenState();
}

class _TeacherDocumentsScreenState extends State<TeacherDocumentsScreen> {
  final _repo = TeacherRepository(Supabase.instance.client);
  final _searchCtrl = TextEditingController();

  List<TeacherDocumentRow> _docs = [];
  bool _loading = true;
  bool _uploading = false;
  double _uploadProgress = 0;
  String? _error;
  String _categoryFilter = 'All';
  String _search = '';

  /// Session-only pins — TODO: persist via Supabase when backend supports favorites.
  final Set<String> _pinnedIds = {};
  final Map<String, String> _thumbUrlCache = {};

  int get _totalBytes =>
      _docs.fold<int>(0, (s, d) => s + (d.fileSize ?? 0));

  double get _usageFraction =>
      (_totalBytes / _quotaBytes).clamp(0.0, 1.0);

  List<TeacherDocumentRow> get _filtered {
    final q = _search.trim().toLowerCase();
    return _docs.where((d) {
      if (_categoryFilter != 'All' && d.category != _categoryFilter) {
        return false;
      }
      if (q.isEmpty) return true;
      return d.documentName.toLowerCase().contains(q);
    }).toList();
  }

  bool get _showRecentSection =>
      _docs.isNotEmpty &&
      _search.trim().isEmpty &&
      _categoryFilter == 'All';

  List<TeacherDocumentRow> get _recentDocs {
    if (!_showRecentSection) return [];
    return _docs.where((d) => !_pinnedIds.contains(d.id)).take(3).toList();
  }

  List<TeacherDocumentRow> get _pinnedDocs {
    final pinned = _filtered.where((d) => _pinnedIds.contains(d.id)).toList();
    final order = <String, int>{
      for (var i = 0; i < _docs.length; i++) _docs[i].id: i,
    };
    pinned.sort(
      (a, b) => (order[a.id] ?? 0).compareTo(order[b.id] ?? 0),
    );
    return pinned;
  }

  List<TeacherDocumentRow> get _mainListDocs {
    final skip = <String>{..._pinnedIds};
    if (_showRecentSection) {
      skip.addAll(_recentDocs.map((d) => d.id));
    }
    return _filtered.where((d) => !skip.contains(d.id)).toList();
  }

  bool _isPinned(TeacherDocumentRow d) => _pinnedIds.contains(d.id);

  void _togglePin(TeacherDocumentRow d) {
    setState(() {
      if (_pinnedIds.contains(d.id)) {
        _pinnedIds.remove(d.id);
      } else {
        _pinnedIds.add(d.id);
      }
    });
  }

  Future<String?> _thumbUrlFor(TeacherDocumentRow d) async {
    final cached = _thumbUrlCache[d.id];
    if (cached != null) return cached;
    final url = await _signedUrlFor(d);
    if (url != null && mounted) {
      _thumbUrlCache[d.id] = url;
    }
    return url;
  }

  void _showUploadSuccess() {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: const Color(0xFF334155),
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
        content: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.16),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_rounded,
                color: Colors.white,
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            const Text(
              'Document uploaded',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(() {
      setState(() => _search = _searchCtrl.text);
    });
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await _repo.loadDocuments(widget.user.id);
      if (!mounted) return;
      setState(() {
        _docs = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = friendlyDataLoadError(e);
        _loading = false;
      });
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Future<String?> _signedUrlFor(TeacherDocumentRow d) =>
      _repo.signedTeacherDocUrl(d.fileUrl);

  static const _openFileChannel = MethodChannel('open_file');

  Future<void> _openLocalDocumentFile({
    required String path,
    required String mimeType,
    required String displayName,
  }) async {
    if (Platform.isAndroid) {
      try {
        await _openFileChannel.invokeMethod<void>('open', {'path': path});
        return;
      } on PlatformException catch (e) {
        debugPrint(
          'Open doc platform: code=${e.code} message=${e.message} path=$path',
        );
        switch (e.code) {
          case 'FILE_NOT_FOUND':
            _snack('File not found on this device.');
            return;
          case 'INVALID_PATH':
            _snack('Could not open this file.');
            return;
          case 'OPEN_ERROR':
            _snack(
              e.message?.trim().isNotEmpty == true
                  ? e.message!.trim()
                  : 'Could not open this file.',
            );
            return;
          default:
            _snack('Could not open this file.');
            return;
        }
      }
    }

    await Share.shareXFiles(
      [
        XFile(
          path,
          mimeType: mimeType.trim().isNotEmpty ? mimeType : null,
          name: displayName,
        ),
      ],
      subject: displayName,
    );
  }

  Future<void> _openDoc(TeacherDocumentRow d) async {
    if (!mounted) return;

    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => PopScope(
        canPop: false,
        child: AlertDialog(
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(strokeWidth: 2.5),
              const SizedBox(height: 14),
              Text(
                'Opening file…',
                style: Theme.of(ctx).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );

    File? cachedFile;
    String? signedUrl;
    try {
      final storagePath = d.fileUrl.trim();
      if (storagePath.startsWith('/') && File(storagePath).existsSync()) {
        cachedFile = File(storagePath);
      } else {
        signedUrl = await _signedUrlFor(d);
        if (signedUrl == null) {
          debugPrint(
            'Open doc: signed URL unavailable. storagePath=$storagePath '
            'docId=${d.id}',
          );
          _snack('Could not prepare file for opening.');
          return;
        }

        final res = await http.get(Uri.parse(signedUrl));
        if (res.statusCode < 200 || res.statusCode >= 300) {
          debugPrint(
            'Open doc: download failed status=${res.statusCode} '
            'url=$signedUrl docId=${d.id}',
          );
          _snack('Download failed. Please try again.');
          return;
        }

        final dir = await getTemporaryDirectory();
        final ext = _fileExtensionForDoc(d);
        final cacheName =
            'teacher_doc_${d.id.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_')}.$ext';
        cachedFile = File('${dir.path}/$cacheName');
        await cachedFile.writeAsBytes(res.bodyBytes, flush: true);
      }

      final localPath = cachedFile.path;
      debugPrint('Open doc: opening localPath=$localPath mime=${d.fileType}');

      await _openLocalDocumentFile(
        path: localPath,
        mimeType: d.fileType,
        displayName: d.documentName,
      );
    } catch (e, st) {
      debugPrint(
        'Open doc exception: docId=${d.id} url=$signedUrl '
        'path=${cachedFile?.path} error=$e\n$st',
      );
      if (mounted) {
        _snack('Could not open this file. Please try again.');
      }
    } finally {
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pop();
      }
    }
  }

  Future<void> _shareDoc(TeacherDocumentRow d) async {
    final url = await _signedUrlFor(d);
    if (url == null) {
      _snack('Could not prepare file for sharing.');
      return;
    }
    try {
      final res = await http.get(Uri.parse(url));
      if (res.statusCode < 200 || res.statusCode >= 300) {
        _snack('Download failed. Please try again.');
        return;
      }
      final bytes = res.bodyBytes;
      final safeName = d.documentName.replaceAll(RegExp(r'[/\\]'), '_');
      await Share.shareXFiles(
        [
          XFile.fromData(
            bytes,
            mimeType: d.fileType,
            name: safeName,
          ),
        ],
        subject: d.documentName,
      );
    } catch (e) {
      _snack(friendlyDataLoadError(e));
    }
  }

  Future<void> _confirmDelete(TeacherDocumentRow d) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete document?'),
        content: Text(
          'Remove “${d.documentName}”? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await _repo.deleteDocument(
        documentId: d.id,
        teacherId: widget.user.id,
      );
      _snack('Document removed.');
      await _load();
    } catch (e) {
      _snack(friendlyDataLoadError(e));
    }
  }

  Future<void> _showDocActions(TeacherDocumentRow d) async {
    final kind = _previewKind(d.fileType);
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 4, 8, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      d.documentName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(ctx).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                            letterSpacing: -0.1,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${d.category} · ${_formatBytes(d.fileSize)}',
                      style: Theme.of(ctx).textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary.withValues(
                              alpha: 0.82,
                            ),
                          ),
                    ),
                  ],
                ),
              ),
              if (kind != _DocPreviewKind.other || _isWordMime(d.fileType))
                _SheetActionTile(
                  icon: Icons.visibility_outlined,
                  label: 'Open',
                  onTap: () {
                    Navigator.pop(ctx);
                    _openDoc(d);
                  },
                ),
              _SheetActionTile(
                icon: Icons.edit_outlined,
                label: 'Edit details',
                onTap: () {
                  Navigator.pop(ctx);
                  _showEditDetails(d);
                },
              ),
              _SheetActionTile(
                icon: Icons.ios_share_rounded,
                label: 'Share / save',
                onTap: () {
                  Navigator.pop(ctx);
                  _shareDoc(d);
                },
              ),
              _SheetActionTile(
                icon: _isPinned(d)
                    ? Icons.star_rounded
                    : Icons.star_outline_rounded,
                label: _isPinned(d) ? 'Unpin' : 'Pin document',
                iconColor: _isPinned(d) ? const Color(0xFFD97706) : null,
                onTap: () {
                  Navigator.pop(ctx);
                  _togglePin(d);
                },
              ),
              const SizedBox(height: 10),
              _SheetActionTile(
                icon: Icons.delete_outline_rounded,
                label: 'Delete',
                destructive: true,
                onTap: () {
                  Navigator.pop(ctx);
                  _confirmDelete(d);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showEditDetails(TeacherDocumentRow d) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (ctx) {
        final keyboardInset = MediaQuery.viewInsetsOf(ctx).bottom;
        return Padding(
          padding: EdgeInsets.only(bottom: keyboardInset),
          child: _EditDocumentSheet(
            initialName: d.documentName,
            initialCategory: d.category,
            categories: _allCategories,
            onSave: (name, category) => _repo.updateDocument(
              documentId: d.id,
              teacherId: widget.user.id,
              documentName: name,
              category: category,
            ),
          ),
        );
      },
    );
    if (saved == true && mounted) {
      _snack('Document updated.');
      await _load();
    }
  }

  Future<void> _upload() async {
    if (_uploading) return;
    if (_totalBytes >= _quotaBytes) {
      _snack('Storage limit reached (100 MB). Delete a file to upload more.');
      return;
    }

    final pick = await FilePicker.platform.pickFiles(
      withData: true,
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
    );
    if (pick == null || pick.files.isEmpty) return;
    final f = pick.files.single;
    final raw = f.bytes;
    if (raw == null || raw.isEmpty) return;
    final bytes = Uint8List.fromList(raw);
    if (bytes.length > _maxDocumentBytes) {
      _snack('File must be 10MB or smaller.');
      return;
    }
    if (_totalBytes + bytes.length > _quotaBytes) {
      _snack('Not enough storage left. Delete a file or choose a smaller one.');
      return;
    }

    var name = f.name.trim().isEmpty ? 'document' : f.name.trim();
    final dot = name.lastIndexOf('.');
    final ext = dot >= 0 ? name.substring(dot) : '';
    final mime = _mimeFromExtension(f.extension ?? ext);
    if (mime == null) {
      _snack('Allowed: PDF, DOC, DOCX, JPG, PNG.');
      return;
    }

    final cleanExt =
        ext.isNotEmpty && ext.startsWith('.') ? ext.substring(1) : ext;

    if (!mounted) return;
    final uploadMeta = await showModalBottomSheet<({String category, String? name})>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (ctx) {
        final keyboardInset = MediaQuery.viewInsetsOf(ctx).bottom;
        return Padding(
          padding: EdgeInsets.only(bottom: keyboardInset),
          child: _UploadSheet(
            fileName: name,
            categories: _allCategories,
            initialCategory: suggestDocumentCategoryFromFileName(name),
          ),
        );
      },
    );
    if (uploadMeta == null || !mounted) return;

    name = uploadMeta.name?.trim().isNotEmpty == true
        ? uploadMeta.name!.trim()
        : name;
    if (name.length > 200) name = name.substring(0, 200);

    final category = uploadMeta.category;
    final extForPath = cleanExt.isNotEmpty
        ? cleanExt
        : (mime.contains('/') ? mime.split('/').last : 'bin');
    final objectPath =
        '${widget.user.id}/${DateTime.now().millisecondsSinceEpoch}.$extForPath';

    File? tempFile;
    setState(() {
      _uploading = true;
      _uploadProgress = 0.08;
    });
    try {
      tempFile = File(
        '${Directory.systemTemp.path}/teacher_upload_${DateTime.now().millisecondsSinceEpoch}',
      );
      await tempFile.writeAsBytes(bytes);
      if (mounted) setState(() => _uploadProgress = 0.35);
      await Supabase.instance.client.storage.from('teacher-docs').upload(
            objectPath,
            tempFile,
            fileOptions: FileOptions(contentType: mime, upsert: false),
          );
      if (mounted) setState(() => _uploadProgress = 0.78);
      await _repo.insertDocumentRow(
        teacherId: widget.user.id,
        name: name,
        fileUrl: objectPath,
        fileType: mime,
        category: category,
        fileSize: bytes.length,
      );
      if (mounted) setState(() => _uploadProgress = 1);
      _showUploadSuccess();
      await _load();
    } catch (e) {
      _snack(friendlyDataLoadError(e));
    } finally {
      if (mounted) {
        setState(() {
          _uploading = false;
          _uploadProgress = 0;
        });
      }
      try {
        if (tempFile != null && await tempFile.exists()) {
          await tempFile.delete();
        }
      } catch (_) {
        /* best-effort */
      }
    }
  }

  Widget _docTile(TeacherDocumentRow d) {
    return _SlidableDocumentTile(
      key: ValueKey(d.id),
      doc: d,
      isPinned: _isPinned(d),
      thumbUrlLoader: () => _thumbUrlFor(d),
      onTap: () => _showDocActions(d),
      onMenu: () => _showDocActions(d),
      onShare: () => _shareDoc(d),
      onDelete: () => _confirmDelete(d),
      onTogglePin: () => _togglePin(d),
    );
  }

  List<Widget> _documentListChildren() {
    final children = <Widget>[];
    void addSection(
      String title,
      List<TeacherDocumentRow> docs, {
      String? subtitle,
    }) {
      if (docs.isEmpty) return;
      children.add(_SectionLabel(title: title, subtitle: subtitle));
      for (var i = 0; i < docs.length; i++) {
        children.add(
          Padding(
            padding: EdgeInsets.only(bottom: i < docs.length - 1 ? 9 : 0),
            child: _docTile(docs[i]),
          ),
        );
      }
      children.add(const SizedBox(height: 4));
    }

    addSection('Pinned', _pinnedDocs);
    if (_showRecentSection) {
      addSection(
        'Recent uploads',
        _recentDocs,
        subtitle: 'Recently added files',
      );
    }
    if (_mainListDocs.isNotEmpty) {
      if (_pinnedDocs.isNotEmpty || _recentDocs.isNotEmpty) {
        children.add(const _SectionLabel(title: 'All documents'));
      }
      for (var i = 0; i < _mainListDocs.length; i++) {
        children.add(
          Padding(
            padding: EdgeInsets.only(
              bottom: i < _mainListDocs.length - 1 ? 9 : 0,
            ),
            child: _docTile(_mainListDocs[i]),
          ),
        );
      }
    }
    return children;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final filtered = _filtered;
    final canPop = Navigator.of(context).canPop();

    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FA),
      appBar: AppBar(
        title: const Text('My documents'),
        backgroundColor: const Color(0xFFF4F6FA),
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: _loading
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(height: MediaQuery.sizeOf(context).height * 0.3),
                  const Center(child: CircularProgressIndicator(strokeWidth: 2.5)),
                ],
              )
            : CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverPadding(
                    padding: EdgeInsets.fromLTRB(
                      TeacherUiTokens.horizontalPadding,
                      canPop ? 8 : 4,
                      TeacherUiTokens.horizontalPadding,
                      0,
                    ),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        _StorageUsageCard(
                          usedBytes: _totalBytes,
                          quotaBytes: _quotaBytes,
                          fraction: _usageFraction,
                        ),
                        const SizedBox(height: 12),
                        _PremiumUploadButton(
                          uploading: _uploading,
                          onPressed: _uploading ? null : _upload,
                          label: _uploading ? 'Uploading…' : 'Upload document',
                          icon: _uploading
                              ? SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: theme.colorScheme.onPrimary,
                                  ),
                                )
                              : const Icon(Icons.upload_rounded, size: 22),
                        ),
                        if (_uploading) ...[
                          const SizedBox(height: 10),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: _uploadProgress > 0 && _uploadProgress < 1
                                  ? _uploadProgress
                                  : null,
                              minHeight: 3,
                              backgroundColor:
                                  AppColors.primary.withValues(alpha: 0.12),
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        _DocumentsSearchField(controller: _searchCtrl),
                        if (_error != null) ...[
                          const SizedBox(height: 10),
                          Text(
                            _error!,
                            style: TextStyle(color: theme.colorScheme.error),
                          ),
                        ],
                      ]),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 10, bottom: 10),
                      child: _CategoryChips(
                        selected: _categoryFilter,
                        onSelected: (v) => setState(() => _categoryFilter = v),
                      ),
                    ),
                  ),
                  SliverPadding(
                    padding: EdgeInsets.fromLTRB(
                      TeacherUiTokens.horizontalPadding,
                      0,
                      TeacherUiTokens.horizontalPadding,
                      88,
                    ),
                    sliver: filtered.isEmpty
                        ? SliverToBoxAdapter(
                            child: _EmptyDocumentsState(
                              hasSearchOrFilter:
                                  _search.trim().isNotEmpty ||
                                  _categoryFilter != 'All',
                            ),
                          )
                        : SliverList(
                            delegate: SliverChildListDelegate(
                              _documentListChildren(),
                            ),
                          ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _StorageUsageCard extends StatefulWidget {
  const _StorageUsageCard({
    required this.usedBytes,
    required this.quotaBytes,
    required this.fraction,
  });

  final int usedBytes;
  final int quotaBytes;
  final double fraction;

  @override
  State<_StorageUsageCard> createState() => _StorageUsageCardState();
}

class _StorageUsageCardState extends State<_StorageUsageCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _shimmerCtrl;

  @override
  void initState() {
    super.initState();
    _shimmerCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();
  }

  @override
  void dispose() {
    _shimmerCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pctLabel =
        _formatStoragePercentUsed(widget.usedBytes, widget.quotaBytes);
    final usedLabel = _formatStorageMb(widget.usedBytes);
    final quotaLabel = _formatStorageMb(widget.quotaBytes);
    final target = widget.fraction.clamp(0.0, 1.0);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.cardBorder.withValues(alpha: 0.7),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F172A),
            blurRadius: 14,
            offset: Offset(0, 4),
            spreadRadius: -3,
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.cloud_outlined,
                  size: 20,
                  color: AppColors.textSecondary.withValues(alpha: 0.75),
                ),
                const SizedBox(width: 8),
                Text(
                  'Storage used',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF334155),
                  ),
                ),
                const Spacer(),
                Text(
                  '$usedLabel / $quotaLabel',
                  style: theme.textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                    letterSpacing: -0.1,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            TweenAnimationBuilder<double>(
              tween: Tween<double>(end: target),
              duration: const Duration(milliseconds: 420),
              curve: Curves.easeOutCubic,
              builder: (context, animatedFraction, _) {
                final barColor = animatedFraction > 0.9
                    ? theme.colorScheme.error.withValues(alpha: 0.82)
                    : AppColors.primary.withValues(alpha: 0.72);

                return ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: SizedBox(
                    height: 6,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        const ColoredBox(color: Color(0xFFE8ECF1)),
                        FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: animatedFraction.clamp(0.0, 1.0),
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              ColoredBox(color: barColor),
                              if (animatedFraction > 0.02)
                                AnimatedBuilder(
                                  animation: _shimmerCtrl,
                                  builder: (context, _) {
                                    return FractionallySizedBox(
                                      widthFactor: 0.42,
                                      alignment: Alignment(
                                        -1.2 + 2.4 * _shimmerCtrl.value,
                                        0,
                                      ),
                                      child: DecoratedBox(
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            colors: [
                                              Colors.white.withValues(
                                                alpha: 0,
                                              ),
                                              Colors.white.withValues(
                                                alpha: 0.28,
                                              ),
                                              Colors.white.withValues(
                                                alpha: 0,
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              Positioned(
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 2,
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [
                                        Colors.white.withValues(alpha: 0.22),
                                        Colors.white.withValues(alpha: 0),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 6),
            Text(
              '$pctLabel% used',
              style: theme.textTheme.labelSmall?.copyWith(
                color: AppColors.textSecondary.withValues(alpha: 0.85),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'PDF, Word, JPG, PNG · up to 10 MB each',
              style: theme.textTheme.labelSmall?.copyWith(
                color: AppColors.textSecondary.withValues(alpha: 0.72),
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PremiumUploadButton extends StatefulWidget {
  const _PremiumUploadButton({
    required this.uploading,
    required this.onPressed,
    required this.label,
    required this.icon,
  });

  final bool uploading;
  final VoidCallback? onPressed;
  final String label;
  final Widget icon;

  @override
  State<_PremiumUploadButton> createState() => _PremiumUploadButtonState();
}

class _PremiumUploadButtonState extends State<_PremiumUploadButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: widget.onPressed == null
          ? null
          : (_) => setState(() => _pressed = true),
      onTapUp: widget.onPressed == null
          ? null
          : (_) => setState(() => _pressed = false),
      onTapCancel: widget.onPressed == null
          ? null
          : () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.985 : 1,
        duration: const Duration(milliseconds: 90),
        curve: Curves.easeOut,
        child: Container(
          height: 48,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            boxShadow: widget.onPressed == null
                ? null
                : [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.2),
                      blurRadius: 16,
                      offset: const Offset(0, 5),
                      spreadRadius: -4,
                    ),
                  ],
          ),
          child: SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton.icon(
              onPressed: widget.onPressed,
              icon: widget.icon,
              label: Text(widget.label),
              style: FilledButton.styleFrom(
                elevation: 0,
                backgroundColor: AppColors.primary,
                disabledBackgroundColor:
                    AppColors.primary.withValues(alpha: 0.55),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DocumentsSearchField extends StatefulWidget {
  const _DocumentsSearchField({required this.controller});

  final TextEditingController controller;

  @override
  State<_DocumentsSearchField> createState() => _DocumentsSearchFieldState();
}

class _DocumentsSearchFieldState extends State<_DocumentsSearchField> {
  final _focusNode = FocusNode();
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() {
      setState(() => _focused = _focusNode.hasFocus);
    });
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final borderColor = _focused
        ? AppColors.primary.withValues(alpha: 0.42)
        : AppColors.cardBorder.withValues(alpha: 0.72);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        boxShadow: _focused
            ? [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                  spreadRadius: -2,
                ),
              ]
            : null,
      ),
      child: TextField(
        controller: widget.controller,
        focusNode: _focusNode,
        decoration: InputDecoration(
          hintText: 'Search documents',
          hintStyle: TextStyle(
            color: AppColors.textSecondary.withValues(alpha: 0.78),
            fontWeight: FontWeight.w400,
          ),
          prefixIcon: Padding(
            padding: const EdgeInsets.only(left: 2),
            child: Icon(
              Icons.search_rounded,
              size: 20,
              color: AppColors.textSecondary.withValues(alpha: 0.42),
            ),
          ),
          prefixIconConstraints: const BoxConstraints(
            minWidth: 38,
            maxWidth: 38,
            minHeight: 40,
          ),
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: borderColor),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: borderColor),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(
              color: AppColors.primary.withValues(alpha: 0.45),
              width: 1.15,
            ),
          ),
          contentPadding: const EdgeInsets.fromLTRB(2, 11, 14, 11),
          isDense: true,
        ),
      ),
    );
  }
}

class _SheetActionTile extends StatelessWidget {
  const _SheetActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.iconColor,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? iconColor;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = destructive
        ? const Color(0xFFDC6B6B)
        : iconColor ?? const Color(0xFF475569);
    final textColor =
        destructive ? const Color(0xFFDC6B6B) : const Color(0xFF334155);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          splashColor: AppColors.primary.withValues(alpha: 0.06),
          highlightColor: AppColors.primary.withValues(alpha: 0.04),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            child: Row(
              children: [
                Icon(icon, size: 22, color: color),
                const SizedBox(width: 14),
                Text(
                  label,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w500,
                    color: textColor,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CategoryChips extends StatelessWidget {
  const _CategoryChips({
    required this.selected,
    required this.onSelected,
  });

  final String selected;
  final ValueChanged<String> onSelected;

  static const _filters = ['All', ..._allCategories];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 34,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: TeacherUiTokens.horizontalPadding,
        ),
        clipBehavior: Clip.none,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            for (var i = 0; i < _filters.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              _CategoryChip(
                label: _filters[i],
                selected: selected == _filters[i],
                onTap: () => onSelected(_filters[i]),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 34,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Ink(
            padding: const EdgeInsets.symmetric(horizontal: 13),
            decoration: BoxDecoration(
            color: selected
                ? AppColors.primary.withValues(alpha: 0.12)
                : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected
                  ? AppColors.primary.withValues(alpha: 0.38)
                  : AppColors.cardBorder.withValues(alpha: 0.78),
            ),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.08),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
            child: Center(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.15,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  color: selected
                      ? AppColors.primaryDark.withValues(alpha: 0.92)
                      : const Color(0xFF475569),
                  letterSpacing: -0.05,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: subtitle == null ? 7 : 6, top: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: const Color(0xFF475569),
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.15,
                ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 2),
            Text(
              subtitle!,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textSecondary.withValues(alpha: 0.62),
                    fontWeight: FontWeight.w400,
                    letterSpacing: 0.05,
                    height: 1.25,
                  ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SlidableDocumentTile extends StatelessWidget {
  const _SlidableDocumentTile({
    super.key,
    required this.doc,
    required this.isPinned,
    required this.thumbUrlLoader,
    required this.onTap,
    required this.onMenu,
    required this.onShare,
    required this.onDelete,
    required this.onTogglePin,
  });

  final TeacherDocumentRow doc;
  final bool isPinned;
  final Future<String?> Function() thumbUrlLoader;
  final VoidCallback onTap;
  final VoidCallback onMenu;
  final VoidCallback onShare;
  final VoidCallback onDelete;
  final VoidCallback onTogglePin;

  @override
  Widget build(BuildContext context) {
    return Slidable(
      key: key,
      closeOnScroll: true,
      endActionPane: ActionPane(
        motion: const StretchMotion(),
        extentRatio: 0.56,
        dragDismissible: false,
        children: [
          SlidableAction(
            onPressed: (_) => onShare(),
            backgroundColor: const Color(0xFF6B6FD8),
            foregroundColor: Colors.white,
            icon: Icons.ios_share_rounded,
            label: 'Share',
            borderRadius: const BorderRadius.horizontal(
              left: Radius.circular(16),
            ),
          ),
          SlidableAction(
            onPressed: (_) => onTogglePin(),
            backgroundColor: const Color(0xFFE8B86D),
            foregroundColor: const Color(0xFF5C4A1E),
            icon: isPinned ? Icons.star_rounded : Icons.star_outline_rounded,
            label: isPinned ? 'Unpin' : 'Pin',
          ),
          SlidableAction(
            onPressed: (_) => onDelete(),
            backgroundColor: const Color(0xFFE57373),
            foregroundColor: Colors.white,
            icon: Icons.delete_outline_rounded,
            label: 'Delete',
            borderRadius: const BorderRadius.horizontal(
              right: Radius.circular(16),
            ),
          ),
        ],
      ),
      child: _DocumentCard(
        doc: doc,
        isPinned: isPinned,
        thumbUrlLoader: thumbUrlLoader,
        onTap: onTap,
        onMenu: onMenu,
      ),
    );
  }
}

class _DocumentCard extends StatelessWidget {
  const _DocumentCard({
    required this.doc,
    required this.isPinned,
    required this.thumbUrlLoader,
    required this.onTap,
    required this.onMenu,
  });

  final TeacherDocumentRow doc;
  final bool isPinned;
  final Future<String?> Function() thumbUrlLoader;
  final VoidCallback onTap;
  final VoidCallback onMenu;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppColors.cardBorder.withValues(alpha: 0.7),
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x060F172A),
                blurRadius: 12,
                offset: Offset(0, 3),
                spreadRadius: -2,
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _DocumentThumbnail(
                  doc: doc,
                  thumbUrlLoader: thumbUrlLoader,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              doc.documentName,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodyLarge?.copyWith(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                letterSpacing: -0.12,
                                height: 1.32,
                                color: const Color(0xFF1E293B),
                              ),
                            ),
                          ),
                          if (isPinned)
                            Padding(
                              padding: const EdgeInsets.only(left: 4, top: 1),
                              child: Icon(
                                Icons.star_rounded,
                                size: 16,
                                color: const Color(0xFFD97706)
                                    .withValues(alpha: 0.9),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      Text(
                        doc.category,
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: AppColors.primaryDark.withValues(alpha: 0.68),
                          fontWeight: FontWeight.w500,
                          fontSize: 11.5,
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        '${_formatUploadedDate(doc.uploadedAt)} · ${_formatBytes(doc.fileSize)}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary.withValues(alpha: 0.68),
                          fontWeight: FontWeight.w400,
                          fontSize: 11.5,
                          height: 1.28,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(
                    Icons.more_vert_rounded,
                    color: AppColors.textSecondary.withValues(alpha: 0.65),
                  ),
                  onPressed: onMenu,
                  tooltip: 'Actions',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DocumentThumbnail extends StatefulWidget {
  const _DocumentThumbnail({
    required this.doc,
    required this.thumbUrlLoader,
  });

  final TeacherDocumentRow doc;
  final Future<String?> Function() thumbUrlLoader;

  @override
  State<_DocumentThumbnail> createState() => _DocumentThumbnailState();
}

class _DocumentThumbnailState extends State<_DocumentThumbnail> {
  String? _url;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final kind = _previewKind(widget.doc.fileType);
    if (kind != _DocPreviewKind.image) return;
    try {
      final url = await widget.thumbUrlLoader();
      if (mounted && url != null) setState(() => _url = url);
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    const size = 48.0;
    final kind = _previewKind(widget.doc.fileType);
    final borderRadius = BorderRadius.circular(12);

    if (kind == _DocPreviewKind.image &&
        _url != null &&
        !_failed) {
      return _ThumbnailFrame(
        fileType: widget.doc.fileType,
        borderRadius: borderRadius,
        child: ClipRRect(
          borderRadius: borderRadius,
          child: Image.network(
            _url!,
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) =>
                _iconContent(kind, widget.doc.fileType),
          ),
        ),
      );
    }

    return _ThumbnailFrame(
      fileType: widget.doc.fileType,
      borderRadius: borderRadius,
      child: _iconContent(kind, widget.doc.fileType),
    );
  }

  Widget _iconContent(_DocPreviewKind kind, String fileType) {
    final tint = _thumbnailTint(fileType);
    return Center(
      child: Icon(
        kind == _DocPreviewKind.other
            ? _fileTypeIcon(widget.doc)
            : switch (kind) {
                _DocPreviewKind.pdf => Icons.picture_as_pdf_rounded,
                _DocPreviewKind.image => Icons.image_rounded,
                _DocPreviewKind.other => Icons.insert_drive_file_outlined,
              },
        color: tint.fg,
        size: 22,
      ),
    );
  }
}

class _ThumbnailFrame extends StatelessWidget {
  const _ThumbnailFrame({
    required this.fileType,
    required this.borderRadius,
    required this.child,
  });

  final String fileType;
  final BorderRadius borderRadius;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    const size = 48.0;
    final tint = _thumbnailTint(fileType);

    return SizedBox(
      width: size,
      height: size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: tint.bg,
          borderRadius: borderRadius,
          border: Border.all(
            color: tint.fg.withValues(alpha: 0.12),
          ),
          boxShadow: [
            BoxShadow(
              color: tint.fg.withValues(alpha: 0.06),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: borderRadius,
          child: Stack(
            fit: StackFit.expand,
            children: [
              child,
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Colors.white.withValues(alpha: 0.38),
                        Colors.white.withValues(alpha: 0.06),
                        Colors.transparent,
                      ],
                      stops: const [0, 0.35, 1],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyDocumentsState extends StatelessWidget {
  const _EmptyDocumentsState({required this.hasSearchOrFilter});

  final bool hasSearchOrFilter;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = hasSearchOrFilter
        ? 'No matching documents'
        : 'No documents yet';
    final subtitle = hasSearchOrFilter
        ? 'No documents match your search or filter.'
        : 'Upload certificates, lesson plans, CVs, and school files here.';

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.cardBorder.withValues(alpha: 0.55),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x040F172A),
            blurRadius: 14,
            offset: Offset(0, 3),
            spreadRadius: -3,
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 26, 24, 26),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppColors.cardBorder.withValues(alpha: 0.45),
                ),
              ),
              child: Icon(
                hasSearchOrFilter
                    ? Icons.search_off_rounded
                    : Icons.folder_open_rounded,
                size: 26,
                color: AppColors.textSecondary.withValues(alpha: 0.32),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: const Color(0xFF475569),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: const Color(0xFF78716C).withValues(alpha: 0.88),
                height: 1.45,
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EditDocumentSheet extends StatefulWidget {
  const _EditDocumentSheet({
    required this.initialName,
    required this.initialCategory,
    required this.categories,
    required this.onSave,
  });

  final String initialName;
  final String initialCategory;
  final List<String> categories;
  final Future<void> Function(String name, String category) onSave;

  @override
  State<_EditDocumentSheet> createState() => _EditDocumentSheetState();
}

class _EditDocumentSheetState extends State<_EditDocumentSheet> {
  late final TextEditingController _nameCtrl;
  late String _category;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.initialName);
    _category = widget.categories.contains(widget.initialCategory)
        ? widget.initialCategory
        : 'Other';
  }

  Future<void> _pickCategory() async {
    FocusScope.of(context).unfocus();
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (ctx) => _CategorySelectorSheet(
        categories: widget.categories,
        selected: _category,
      ),
    );
    if (picked != null && mounted) {
      setState(() => _category = picked);
    }
  }

  void _localSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        content: Text(message),
      ),
    );
  }

  Future<void> _save() async {
    if (_saving) return;

    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      _localSnack('Display name is required.');
      return;
    }
    if (name.length > 200) {
      _localSnack('Display name must be 200 characters or fewer.');
      return;
    }

    final initialName = widget.initialName.trim();
    if (name == initialName && _category == widget.initialCategory) {
      _localSnack('No changes to save.');
      return;
    }

    setState(() => _saving = true);
    try {
      await widget.onSave(name, _category);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) _localSnack(friendlyDataLoadError(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomSafe = MediaQuery.paddingOf(context).bottom;
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;

    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.88,
        ),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            20,
            4,
            20,
            16 + bottomSafe + (keyboardInset > 0 ? 24 : 0),
          ),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Edit document',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _nameCtrl,
                enabled: !_saving,
                scrollPadding: EdgeInsets.only(
                  bottom: keyboardInset + 32,
                ),
                decoration: const InputDecoration(
                  labelText: 'Display name',
                  border: OutlineInputBorder(),
                ),
                maxLength: 200,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 10),
              _CategoryPickerField(
                category: _category,
                onTap: _saving ? () {} : _pickCategory,
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: _saving ? null : _save,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  minimumSize: const Size.fromHeight(48),
                ),
                child: _saving
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Save changes'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UploadSheet extends StatefulWidget {
  const _UploadSheet({
    required this.fileName,
    required this.categories,
    required this.initialCategory,
  });

  final String fileName;
  final List<String> categories;
  final String initialCategory;

  @override
  State<_UploadSheet> createState() => _UploadSheetState();
}

class _UploadSheetState extends State<_UploadSheet> {
  late final TextEditingController _nameCtrl;
  late String _category;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.fileName);
    _category = widget.categories.contains(widget.initialCategory)
        ? widget.initialCategory
        : 'Other';
  }

  Future<void> _pickCategory() async {
    FocusScope.of(context).unfocus();
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (ctx) => _CategorySelectorSheet(
        categories: widget.categories,
        selected: _category,
      ),
    );
    if (picked != null && mounted) {
      setState(() => _category = picked);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomSafe = MediaQuery.paddingOf(context).bottom;
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;

    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.88,
        ),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            20,
            4,
            20,
            16 + bottomSafe + (keyboardInset > 0 ? 24 : 0),
          ),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Upload document',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _nameCtrl,
                scrollPadding: EdgeInsets.only(
                  bottom: keyboardInset + 32,
                ),
                decoration: const InputDecoration(
                  labelText: 'Display name',
                  border: OutlineInputBorder(),
                ),
                maxLength: 200,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 10),
              _CategoryPickerField(
                category: _category,
                onTap: _pickCategory,
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: () {
                  Navigator.pop(
                    context,
                    (category: _category, name: _nameCtrl.text),
                  );
                },
                child: const Text('Upload'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tappable category field on the upload sheet (opens selector sheet).
class _CategoryPickerField extends StatelessWidget {
  const _CategoryPickerField({
    required this.category,
    required this.onTap,
  });

  final String category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Category',
          style: theme.textTheme.labelMedium?.copyWith(
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondary.withValues(alpha: 0.9),
          ),
        ),
        const SizedBox(height: 6),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(12),
            child: Ink(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.cardBorder.withValues(alpha: 0.78),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 13,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        _categoryIcon(category),
                        size: 20,
                        color: AppColors.primary.withValues(alpha: 0.88),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        category,
                        style: theme.textTheme.bodyLarge?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF334155),
                        ),
                      ),
                    ),
                    Icon(
                      Icons.expand_more_rounded,
                      color: AppColors.textSecondary.withValues(alpha: 0.55),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Premium category picker — separate sheet so it does not fight the keyboard.
class _CategorySelectorSheet extends StatelessWidget {
  const _CategorySelectorSheet({
    required this.categories,
    required this.selected,
  });

  final List<String> categories;
  final String selected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottomSafe = MediaQuery.paddingOf(context).bottom;

    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.72,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
              child: Text(
                'Choose category',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                padding: EdgeInsets.fromLTRB(16, 0, 16, 12 + bottomSafe),
                itemCount: categories.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final label = categories[i];
                  final isSelected = label == selected;
                  return _CategorySelectorTile(
                    label: label,
                    selected: isSelected,
                    onTap: () => Navigator.pop(context, label),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategorySelectorTile extends StatelessWidget {
  const _CategorySelectorTile({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          decoration: BoxDecoration(
            color: selected
                ? AppColors.primary.withValues(alpha: 0.1)
                : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected
                  ? AppColors.primary.withValues(alpha: 0.38)
                  : AppColors.cardBorder.withValues(alpha: 0.72),
              width: selected ? 1.25 : 1,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: selected
                        ? AppColors.primary.withValues(alpha: 0.14)
                        : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(
                    _categoryIcon(label),
                    size: 21,
                    color: selected
                        ? AppColors.primary
                        : AppColors.textSecondary.withValues(alpha: 0.75),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      fontWeight:
                          selected ? FontWeight.w700 : FontWeight.w500,
                      color: selected
                          ? AppColors.primaryDark.withValues(alpha: 0.92)
                          : const Color(0xFF334155),
                    ),
                  ),
                ),
                if (selected)
                  Icon(
                    Icons.check_circle_rounded,
                    color: AppColors.primary.withValues(alpha: 0.9),
                    size: 22,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

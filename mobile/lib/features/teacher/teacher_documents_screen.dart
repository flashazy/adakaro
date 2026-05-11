import 'dart:io';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/errors/load_error_mapper.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/teacher_ui_tokens.dart';
import '../../data/models/teacher_models.dart';
import '../../data/teacher_repository.dart';

const int _maxDocumentBytes = 10 * 1024 * 1024;

final _uploadCategories = <String>[
  'Certificates',
  'CV/Resume',
  'Lesson Plans',
  'Training',
  'Administrative',
  'Personal',
  'Other',
];

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

  List<TeacherDocumentRow> _docs = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
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

  Future<void> _openDoc(TeacherDocumentRow d) async {
    final url = await _repo.signedTeacherDocUrl(d.fileUrl);
    if (url == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open this file.')),
        );
      }
      return;
    }
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _upload() async {
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
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('File must be 10MB or smaller.')),
        );
      }
      return;
    }

    var name = f.name.trim().isEmpty ? 'document' : f.name.trim();
    final dot = name.lastIndexOf('.');
    final ext = dot >= 0 ? name.substring(dot) : '';
    final mime = _mimeFromExtension(f.extension ?? ext);
    if (mime == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Allowed: PDF, DOC, DOCX, JPG, PNG.')),
        );
      }
      return;
    }

    final cleanExt =
        ext.isNotEmpty && ext.startsWith('.') ? ext.substring(1) : ext;

    String category = 'Other';
    if (mounted) {
      category = await showDialog<String>(
            context: context,
            builder: (ctx) => SimpleDialog(
              title: const Text('Category'),
              children: [
                for (final c in _uploadCategories)
                  SimpleDialogOption(
                    onPressed: () => Navigator.pop(ctx, c),
                    child: Text(c),
                  ),
              ],
            ),
          ) ??
          'Other';
    }

    final objectPath =
        '${widget.user.id}/${DateTime.now().millisecondsSinceEpoch}.${cleanExt.isNotEmpty ? cleanExt : mime.split('/').last}';

    File? tempFile;
    try {
      final safeStem =
          DateTime.now().millisecondsSinceEpoch.toString();
      tempFile =
          File('${Directory.systemTemp.path}/teacher_upload_$safeStem');
      await tempFile.writeAsBytes(bytes);
      await Supabase.instance.client.storage.from('teacher-docs').upload(
            objectPath,
            tempFile,
            fileOptions: FileOptions(contentType: mime, upsert: false),
          );
      await _repo.insertDocumentRow(
        teacherId: widget.user.id,
        name: name.length > 200 ? name.substring(0, 200) : name,
        fileUrl: objectPath,
        fileType: mime,
        category: category,
        fileSize: bytes.length,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Uploaded.')),
        );
        await _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyDataLoadError(e))),
        );
      }
    } finally {
      try {
        if (tempFile != null && await tempFile.exists()) {
          await tempFile.delete();
        }
      } catch (_) {
        /* best-effort */
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.of(context).canPop();
    return Scaffold(
      appBar: canPop
          ? AppBar(
              title: const Text('My documents'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: _loading
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(height: MediaQuery.sizeOf(context).height * 0.25),
                  const Center(child: CircularProgressIndicator()),
                ],
              )
            : ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(
                  TeacherUiTokens.horizontalPadding,
                  16,
                  TeacherUiTokens.horizontalPadding,
                  100,
                ),
                children: [
                  if (!canPop) ...[
                    Text(
                      'My documents',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        _error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                  if (_docs.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 40),
                      child: Text(
                        widget.data.assignments.isNotEmpty ||
                                widget.data.classTeacherClasses.isNotEmpty
                            ? 'Personal files stored securely. Tap Upload to add one.'
                            : 'When your school links your account, you can attach documents.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppColors.textSecondary,
                              height: 1.45,
                            ),
                      ),
                    )
                  else ...[
                    for (final d in _docs)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Card(
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor:
                                  AppColors.primary.withValues(alpha: 0.09),
                              child: Icon(
                                Icons.description_rounded,
                                color: AppColors.primary,
                              ),
                            ),
                            title: Text(
                              d.documentName,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            subtitle: Text(
                              '${d.category} · ${_shortMime(d.fileType)}',
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.open_in_new_rounded),
                              onPressed: () => _openDoc(d),
                            ),
                          ),
                        ),
                      ),
                  ],
                ],
              ),
      ),
      floatingActionButton: FloatingActionButton(
        tooltip: 'Upload',
        onPressed: _upload,
        child: const Icon(Icons.upload_rounded),
      ),
    );
  }

  static String _shortMime(String mime) =>
      mime.contains('/') ? mime.split('/').last : mime;
}

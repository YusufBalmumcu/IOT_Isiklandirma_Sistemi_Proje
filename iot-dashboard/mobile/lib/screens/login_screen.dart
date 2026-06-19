import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _formKey  = GlobalKey<FormState>();
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _ipCtrl   = TextEditingController();
  bool _obscure    = true;
  bool _showServer = false;
  late AnimationController _anim;
  late Animation<double>   _fadeAnim;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
    _fadeAnim = CurvedAnimation(parent: _anim, curve: Curves.easeOut);
    _anim.forward();
    _loadSavedIp();
  }

  Future<void> _loadSavedIp() async {
    final auth = context.read<AuthProvider>();
    final saved = await auth.getSavedServerIp();
    if (mounted) {
      setState(() => _ipCtrl.text = saved ?? '10.100.254.131');
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    if (_ipCtrl.text.trim().isNotEmpty) {
      await auth.setServerIp(_ipCtrl.text.trim());
    }
    final ok = await auth.login(_userCtrl.text.trim(), _passCtrl.text);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.errorMsg ?? 'Giriş başarısız'),
          backgroundColor: AppTheme.danger,
        ),
      );
    }
  }

  @override
  void dispose() {
    _anim.dispose();
    _userCtrl.dispose();
    _passCtrl.dispose();
    _ipCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0A0E1A), Color(0xFF0F172A), Color(0xFF1E1B4B)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(28),
              child: FadeTransition(
                opacity: _fadeAnim,
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // ── Logo ────────────────────────────────────────────
                      Center(
                        child: Container(
                          width: 80, height: 80,
                          margin: const EdgeInsets.only(bottom: 24),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: const LinearGradient(
                              colors: [AppTheme.accent, Color(0xFF6366F1)],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: AppTheme.accent.withOpacity(0.4),
                                blurRadius: 24, spreadRadius: 4,
                              ),
                            ],
                          ),
                          child: const Icon(Icons.lightbulb, color: Colors.white, size: 40),
                        ),
                      ),
                      Text(
                        'IoT Dashboard',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 28, fontWeight: FontWeight.w800,
                          color: context.textPrimary, letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Akıllı Işık Kontrol Sistemi',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 14, color: context.textSecondary),
                      ),
                      const SizedBox(height: 36),

                      // ── Sunucu Ayarları (accordion) ─────────────────────
                      GestureDetector(
                        onTap: () => setState(() => _showServer = !_showServer),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: _showServer
                                ? AppTheme.accent.withOpacity(0.12)
                                : const Color(0xFF1C2537),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: _showServer ? AppTheme.accent : const Color(0xFF1E2D45),
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.dns_rounded,
                                  color: _showServer ? AppTheme.accent : context.textSecondary,
                                  size: 18),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  _showServer
                                      ? 'Sunucu Ayarları'
                                      : 'Sunucu: ${_ipCtrl.text.isNotEmpty ? _ipCtrl.text : "?"}:3001',
                                  style: TextStyle(
                                    color: _showServer ? AppTheme.accent : context.textSecondary,
                                    fontSize: 13, fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                              Icon(
                                _showServer ? Icons.expand_less : Icons.expand_more,
                                color: context.textSecondary, size: 20,
                              ),
                            ],
                          ),
                        ),
                      ),

                      // ── IP Alanı (sadece açıkken) ───────────────────────
                      AnimatedSize(
                        duration: const Duration(milliseconds: 250),
                        curve: Curves.easeInOut,
                        child: _showServer
                            ? Padding(
                                padding: const EdgeInsets.only(top: 10),
                                child: TextFormField(
                                  controller: _ipCtrl,
                                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                  style: TextStyle(color: context.textPrimary),
                                  decoration: InputDecoration(
                                    labelText: 'Sunucu IP Adresi',
                                    hintText: '192.168.1.100',
                                    prefixIcon: Icon(Icons.router_rounded, color: AppTheme.accent),
                                    suffixText: ':3001',
                                    suffixStyle: TextStyle(color: context.textSecondary),
                                    helperText: 'Backend\'in çalıştığı bilgisayarın IP\'si',
                                  ),
                                  validator: (v) {
                                    if (v == null || v.isEmpty) return 'IP gerekli';
                                    if (v.trim().split('.').length != 4) {
                                      return 'Geçerli IP girin (ör: 192.168.1.100)';
                                    }
                                    return null;
                                  },
                                ),
                              )
                            : const SizedBox.shrink(),
                      ),
                      const SizedBox(height: 16),

                      // ── Kullanıcı adı ────────────────────────────────────
                      TextFormField(
                        controller: _userCtrl,
                        style: TextStyle(color: context.textPrimary),
                        decoration: InputDecoration(
                          labelText:  'Kullanıcı Adı',
                          prefixIcon: Icon(Icons.person_outline, color: context.textSecondary),
                        ),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Kullanıcı adı gerekli' : null,
                      ),
                      const SizedBox(height: 16),

                      // ── Şifre ────────────────────────────────────────────
                      TextFormField(
                        controller: _passCtrl,
                        obscureText: _obscure,
                        style: TextStyle(color: context.textPrimary),
                        decoration: InputDecoration(
                          labelText:  'Şifre',
                          prefixIcon: Icon(Icons.lock_outline, color: context.textSecondary),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscure ? Icons.visibility_off : Icons.visibility,
                              color: context.textSecondary,
                            ),
                            onPressed: () => setState(() => _obscure = !_obscure),
                          ),
                        ),
                        onFieldSubmitted: (_) => _submit(),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Şifre gerekli' : null,
                      ),
                      const SizedBox(height: 32),

                      // ── Giriş butonu ─────────────────────────────────────
                      SizedBox(
                        height: 52,
                        child: ElevatedButton(
                          onPressed: auth.loading ? null : _submit,
                          child: auth.loading
                              ? const SizedBox(
                                  width: 22, height: 22,
                                  child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2.5,
                                  ),
                                )
                              : const Text('Giriş Yap'),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // ── Bilgi notu ───────────────────────────────────────
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: context.bgSurface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: context.border),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline, color: AppTheme.accent, size: 16),
                            const SizedBox(width: 8),
                            Text(
                              'Varsayılan: admin / admin123',
                              style: TextStyle(color: context.textSecondary, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

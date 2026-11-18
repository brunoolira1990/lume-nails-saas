import React, { useEffect, useState } from 'react';
import { Palette, Sparkles, Check, Plus, Trash2, X, Eye, Loader2 } from 'lucide-react';
import { PolishDraft, PolishItem, NailShape } from '../types';

interface PolishStudioViewProps {
  polishes: PolishItem[];
  onAddPolish: (draft: PolishDraft) => Promise<boolean>;
  onDeletePolish: (id: string) => Promise<boolean>;
}

/** Cor neutra exibida quando a esmalteca ainda não tem nenhum esmalte. */
const EMPTY_NAIL_COLOR = '#E7E5E4';

type FinishEffect = 'cremoso' | 'fosco' | 'francesinha' | 'glitter' | 'babyboomer';

/** Remove cores repetidas mantendo a ordem da esmalteca. */
function uniqueByColor(polishes: PolishItem[]): PolishItem[] {
  const seen = new Set<string>();
  return polishes.filter((p) => {
    const key = p.colorHex.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const PolishStudioView: React.FC<PolishStudioViewProps> = ({
  polishes,
  onAddPolish,
  onDeletePolish,
}) => {
  // Simulator states
  const [selectedShape, setSelectedShape] = useState<NailShape>('amendoada');
  const [selectedPolishId, setSelectedPolishId] = useState<string | null>(null);
  const [accentPolishId, setAccentPolishId] = useState<string | null>(null);
  const [finishEffect, setFinishEffect] = useState<FinishEffect>('cremoso');
  const [accentFinger, setAccentFinger] = useState<boolean>(true); // filha única no anelar

  // Polish catalog states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // New polish form
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newColorHex, setNewColorHex] = useState('#E2B8A8');

  // A esmalteca vem do banco: se a cor selecionada sumir (exclusão), cai para
  // a primeira disponível.
  useEffect(() => {
    if (selectedPolishId && polishes.some((p) => p.id === selectedPolishId)) return;
    setSelectedPolishId(polishes[0]?.id ?? null);
  }, [polishes, selectedPolishId]);

  useEffect(() => {
    if (accentPolishId && polishes.some((p) => p.id === accentPolishId)) return;
    setAccentPolishId(null);
  }, [polishes, accentPolishId]);

  const selectedPolish = polishes.find((p) => p.id === selectedPolishId) ?? null;
  const accentPolish = polishes.find((p) => p.id === accentPolishId) ?? null;
  const selectedColor = selectedPolish?.colorHex || EMPTY_NAIL_COLOR;
  const accentColor = accentPolish?.colorHex || selectedColor;
  const quickPalette = uniqueByColor(polishes).slice(0, 12);
  const accentPalette = uniqueByColor(polishes).slice(0, 6);

  const shapesList: { id: NailShape; name: string; description: string }[] = [
    { id: 'amendoada', name: 'Amendoada', description: 'Alongada e curvada na ponta' },
    { id: 'quadrada', name: 'Quadrada', description: 'Linhas retas com cantos vivos' },
    { id: 'bailarina', name: 'Bailarina (Coffin)', description: 'Estreita com ponta quadrada reta' },
    { id: 'stiletto', name: 'Stiletto', description: 'Ponta triangular afiada' },
    { id: 'oval', name: 'Oval', description: 'Bordas suaves e ponta arredondada' },
    { id: 'redonda', name: 'Redonda', description: 'Curvatura natural da ponta dos dedos' },
  ];

  const openAddModal = () => {
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleAddPolishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const name = newName.trim();
    const brand = newBrand.trim();
    if (!name || !brand) {
      setFormError('Preencha o nome e a marca do esmalte.');
      return;
    }

    const colorHex = newColorHex.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
      setFormError('Informe a cor no formato hexadecimal, ex: #E2B8A8.');
      return;
    }

    setIsSaving(true);
    const saved = await onAddPolish({ name, brand, colorHex });
    setIsSaving(false);

    if (!saved) {
      setFormError('Não foi possível salvar o esmalte. Tente novamente.');
      return;
    }

    setIsAddModalOpen(false);
    setNewName('');
    setNewBrand('');
    setNewColorHex('#E2B8A8');
    setFormError('');
  };

  const handleDeletePolish = async (polish: PolishItem) => {
    const confirmed = window.confirm(`Excluir o esmalte "${polish.name}" da esmalteca?`);
    if (!confirmed) return;
    await onDeletePolish(polish.id);
  };

  // Shape rendering helpers
  const getNailBorderRadius = (shape: NailShape) => {
    switch (shape) {
      case 'quadrada':
        return '4px 4px 18px 18px';
      case 'amendoada':
        return '50% 50% 20px 20px';
      case 'bailarina':
        return '10px 10px 18px 18px';
      case 'stiletto':
        return '60% 60% 20px 20px';
      case 'oval':
        return '45% 45% 20px 20px';
      case 'redonda':
        return '35% 35% 20px 20px';
    }
  };

  const getNailClipPath = (shape: NailShape) => {
    if (shape === 'bailarina') {
      return 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)';
    }
    if (shape === 'stiletto') {
      return 'polygon(50% 0%, 100% 90%, 85% 100%, 15% 100%, 0% 90%)';
    }
    return 'none';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#7C3AED] bg-[#F5F3FF] px-2.5 py-0.5 rounded-md border border-[#E3DFFD]">
            Estúdio Criativo
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold font-['Playfair_Display',serif] text-stone-900 mt-1">
          Simulador de Unhas & Esmalteca
        </h1>
        <p className="text-xs text-stone-500">
          Mostruário digital para auxiliar suas clientes na escolha do formato, cores e efeitos antes de iniciar o atendimento.
        </p>
      </div>

      {/* Interactive Simulator Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Canvas Preview */}
        <div className="lg:col-span-6 bg-gradient-to-b from-stone-50 to-[#F5F3FF]/40 rounded-2xl p-6 border border-stone-200 shadow-xs flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between mb-4">
            <div>
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Pré-Visualização em Tempo Real
              </span>
              <p className="text-sm font-bold text-stone-900 capitalize">
                Formato {selectedShape} • Efeito {finishEffect}
              </p>
              <p className="text-xs text-[#7C3AED] font-semibold">
                {selectedPolish ? `${selectedPolish.name} (${selectedPolish.brand})` : 'Nenhum esmalte cadastrado'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-stone-200 shadow-2xs">
                <input
                  type="checkbox"
                  checked={accentFinger}
                  onChange={(e) => setAccentFinger(e.target.checked)}
                  className="rounded-sm border-stone-300 text-[#7C3AED] focus:ring-[#C4B5FD] w-3.5 h-3.5"
                />
                <span>Filha Única</span>
              </label>
            </div>
          </div>

          {/* Hand & Fingers Vector Simulator */}
          <div className="relative w-full max-w-sm h-72 flex items-end justify-center gap-3 sm:gap-4 pb-4">
            {/* 5 Fingers: Polegar, Indicador, Médio, Anelar, Mínimo */}
            {[
              { name: 'Polegar', height: 'h-36', width: 'w-10 sm:w-11', nailH: 'h-13', nailW: 'w-8', isRing: false },
              { name: 'Indicador', height: 'h-48', width: 'w-9 sm:w-10', nailH: 'h-13', nailW: 'w-7.5', isRing: false },
              { name: 'Médio', height: 'h-54', width: 'w-9 sm:w-10', nailH: 'h-14', nailW: 'w-7.5', isRing: false },
              { name: 'Anelar', height: 'h-48', width: 'w-9 sm:w-10', nailH: 'h-13', nailW: 'w-7.5', isRing: true },
              { name: 'Mínimo', height: 'h-38', width: 'w-8 sm:w-8.5', nailH: 'h-11', nailW: 'w-6.5', isRing: false },
            ].map((finger, idx) => {
              const isAccent = accentFinger && finger.isRing;
              const nailColor = isAccent ? accentColor : selectedColor;

              return (
                <div
                  key={idx}
                  className={`relative flex flex-col items-center justify-start ${finger.height} ${finger.width} bg-[#f1d0be] rounded-t-3xl border-t border-l border-r border-[#e3b7a1] shadow-md`}
                >
                  {/* Finger Joint Line */}
                  <div className="absolute top-20 w-3/4 h-0.5 bg-[#e3b7a1]/60 rounded-full" />
                  <div className="absolute top-28 w-2/3 h-0.5 bg-[#e3b7a1]/40 rounded-full" />

                  {/* Nail Plate */}
                  <div
                    style={{
                      borderRadius: getNailBorderRadius(selectedShape),
                      clipPath: getNailClipPath(selectedShape),
                      backgroundColor: nailColor,
                    }}
                    className={`relative ${finger.nailH} ${finger.nailW} -mt-3 shadow-inner overflow-hidden transition-all duration-300 border border-black/10`}
                  >
                    {/* Gloss / Shine Highlight */}
                    {finishEffect !== 'fosco' && (
                      <div className="absolute top-1 left-1.5 w-1.5 h-3/4 bg-white/40 rounded-full blur-[0.5px] pointer-events-none" />
                    )}

                    {/* Francesinha Effect */}
                    {finishEffect === 'francesinha' && (
                      <div
                        className={`absolute top-0 inset-x-0 h-3 ${
                          isAccent ? 'bg-amber-300' : 'bg-white'
                        } shadow-xs border-b border-white/20`}
                      />
                    )}

                    {/* Babyboomer / Degradê */}
                    {finishEffect === 'babyboomer' && (
                      <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-transparent to-transparent pointer-events-none" />
                    )}

                    {/* Glitter Spangles */}
                    {(finishEffect === 'glitter' || isAccent) && (
                      <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:6px_6px] opacity-70 pointer-events-none" />
                    )}

                    {/* Matte finish overlay */}
                    {finishEffect === 'fosco' && (
                      <div className="absolute inset-0 bg-black/10 backdrop-blur-[0.5px] pointer-events-none" />
                    )}
                  </div>

                  <span className="text-[9px] text-[#b07f67] font-medium absolute -bottom-5">
                    {finger.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Color Palettes Swatches in Simulator */}
          <div className="w-full mt-6 pt-4 border-t border-stone-200">
            <span className="text-[11px] font-semibold text-stone-600 block mb-2">
              Toque em uma cor cadastrada na esmalteca:
            </span>
            {quickPalette.length === 0 ? (
              <p className="text-[11px] text-stone-500">
                Nenhum esmalte cadastrado ainda. Use "Adicionar Esmalte" abaixo para montar sua esmalteca.
              </p>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {quickPalette.map((polish) => (
                  <button
                    key={polish.id}
                    title={`${polish.name} (${polish.brand})`}
                    onClick={() => setSelectedPolishId(polish.id)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 shrink-0 cursor-pointer flex items-center justify-center ${
                      selectedColor === polish.colorHex
                        ? 'border-[#E3DFFD]/80 ring-2 ring-[#C4B5FD]/20'
                        : 'border-white shadow-xs'
                    }`}
                    style={{ backgroundColor: polish.colorHex }}
                  >
                    {selectedColor === polish.colorHex && (
                      <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls & Shapes */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-5">
          {/* Format / Shape Selector */}
          <div>
            <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-2.5">
              1. Escolha o Formato da Unha
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {shapesList.map((shape) => {
                const isSelected = selectedShape === shape.id;
                return (
                  <button
                    key={shape.id}
                    onClick={() => setSelectedShape(shape.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#F5F3FF] border-[#C4B5FD] text-stone-900 shadow-xs'
                        : 'bg-stone-50/50 border-stone-200 hover:bg-stone-100 text-stone-700'
                    }`}
                  >
                    <p className="text-xs font-bold leading-tight">{shape.name}</p>
                    <p className="text-[10px] text-stone-500 mt-1 line-clamp-1">{shape.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Finish / Effect Selector */}
          <div>
            <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-2.5">
              2. Acabamento & Efeito
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'cremoso', label: 'Brilho Verniz / Gel', desc: 'Gloss intenso' },
                { id: 'fosco', label: 'Efeito Fosco (Matte)', desc: 'Toque aveludado' },
                { id: 'francesinha', label: 'Francesinha Sorriso', desc: 'Ponta clássica' },
                { id: 'babyboomer', label: 'Babyboomer / Degradê', desc: 'Transição suave' },
                { id: 'glitter', label: 'Glitter Total', desc: 'Brilho luxuoso' },
              ].map((fx: { id: FinishEffect; label: string; desc: string }) => (
                <button
                  key={fx.id}
                  onClick={() => setFinishEffect(fx.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    finishEffect === fx.id
                      ? 'bg-stone-900 border-stone-900 text-white shadow-2xs'
                      : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <p className="text-xs font-bold">{fx.label}</p>
                  <p className={`text-[10px] mt-0.5 ${finishEffect === fx.id ? 'text-stone-300' : 'text-stone-400'}`}>
                    {fx.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Filha Única Color Option */}
          {accentFinger && (
            <div className="bg-[#F5F3FF]/50 p-3 rounded-xl border border-[#E3DFFD]/70">
              <span className="text-xs font-semibold text-stone-900 block mb-1.5">
                Cor da Filha Única (Dedo Anelar):
              </span>
              {accentPalette.length === 0 ? (
                <p className="text-[11px] text-stone-500">
                  Cadastre esmaltes para escolher a cor do dedo anelar.
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  {accentPalette.map((polish) => {
                    const isActive = accentPolish?.id === polish.id;
                    return (
                      <button
                        key={polish.id}
                        onClick={() => setAccentPolishId(isActive ? null : polish.id)}
                        className={`w-6 h-6 rounded-full border border-stone-300 cursor-pointer ${
                          isActive ? 'ring-2 ring-[#C4B5FD] scale-110' : ''
                        }`}
                        style={{ backgroundColor: polish.colorHex }}
                        title={`${polish.name} (${polish.brand})`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Studio Polish Inventory Section */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#8B5CF6]" />
              Esmalteca do Studio ({polishes.length} {polishes.length === 1 ? 'esmalte' : 'esmaltes'})
            </h2>
            <p className="text-xs text-stone-500">
              Os esmaltes cadastrados aqui alimentam o simulador de unhas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#6D28D9] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Esmalte</span>
            </button>
          </div>
        </div>

        {/* Polishes Grid */}
        {polishes.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-8 text-center">
            <Sparkles className="w-6 h-6 text-stone-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-stone-700">Sua esmalteca está vazia</p>
            <p className="text-[11px] text-stone-500 mt-1">
              Cadastre seus vidrinhos com marca, nome e cor para começar a simular.
            </p>
            <button
              onClick={openAddModal}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Esmalte</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-4">
            {polishes.map((polish) => {
              const isSelected = selectedPolish?.id === polish.id;
              return (
                <div
                  key={polish.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#F5F3FF]/70 border-[#C4B5FD]'
                      : 'bg-stone-50/70 border-stone-200 hover:border-[#E3DFFD]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span
                        className="w-5 h-5 rounded-full border border-black/10 shadow-xs shrink-0"
                        style={{ backgroundColor: polish.colorHex }}
                      />
                      {isSelected && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border bg-white text-[#6D28D9] border-[#E3DFFD]">
                          No simulador
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-stone-900 line-clamp-1">{polish.name}</h4>
                    <p className="text-[11px] text-stone-500 line-clamp-1">{polish.brand}</p>
                    <span className="text-[10px] text-stone-400 mt-0.5 block">{polish.colorHex}</span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-stone-200/60 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedPolishId(polish.id)}
                      className="text-[10px] font-bold text-[#7C3AED] hover:text-[#6D28D9] flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Testar</span>
                    </button>

                    <button
                      onClick={() => handleDeletePolish(polish)}
                      title={`Excluir ${polish.name}`}
                      className="text-stone-400 hover:text-red-600 p-1 rounded-sm cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add Polish */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-900">Novo Esmalte na Bancada</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-md text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddPolishSubmit} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nome da Cor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Grão de Café"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Marca *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Risqué, Impala, Vòlia"
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Cor do Esmalte *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Selecionar cor do esmalte"
                    value={newColorHex}
                    onChange={(e) => setNewColorHex(e.target.value)}
                    className="w-10 h-9 shrink-0 bg-transparent cursor-pointer rounded-lg border border-stone-300"
                  />
                  <input
                    type="text"
                    value={newColorHex}
                    onChange={(e) => setNewColorHex(e.target.value)}
                    placeholder="#E2B8A8"
                    className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs font-mono uppercase text-stone-900 focus:outline-hidden"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSaving}
                  className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs font-semibold disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#6D28D9] text-white text-xs font-bold shadow-xs disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSaving ? 'Salvando...' : 'Salvar Esmalte'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

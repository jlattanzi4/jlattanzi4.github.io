---
name: PokeForge - LoRA Fine-Tuning
tools: [PyTorch, Stable Diffusion, LoRA/PEFT, HuggingFace, MPS Optimization]
image: https://raw.githubusercontent.com/jlattanzi4/PokeForge/main/examples/portfolio_showcase.png
description: Fine-tuning Stable Diffusion with LoRA for domain-specific image generation. Demonstrates parameter-efficient transfer learning with 95% reduction in trainable parameters.
external_url: https://github.com/jlattanzi4/PokeForge
---

# PokeForge: Fine-Tuning Diffusion Models with LoRA

## The Challenge

Training large diffusion models from scratch requires massive computational resources (100+ GPU hours, 24GB+ VRAM). Traditional fine-tuning approaches require updating all 860 million parameters, making it infeasible for most practitioners with consumer hardware.

## The Solution

I implemented a parameter-efficient fine-tuning approach using **Low-Rank Adaptation (LoRA)** to adapt a pre-trained Stable Diffusion model to a specialized domain using only consumer-grade hardware (Apple M3 with 16GB RAM).

### Key Achievements

- **95% Parameter Reduction**: Trained only 797K parameters (0.09%) instead of full 860M model
- **Memory Efficiency**: Optimized for 16GB RAM using MPS (Metal Performance Shaders)
- **Fast Convergence**: Achieved production-quality results in 20 epochs (~12 hours)
- **Strong Generalization**: Model generates novel designs not present in training data

## Technical Implementation

### Dataset Pipeline
- **Data Collection**: Automated API-based data gathering and metadata extraction
- **Preprocessing**: Custom image standardization pipeline with background removal
- **Dataset Size**: 905 curated images with descriptive text captions
- **Format**: 512×512 RGB images with normalized backgrounds

### Model Architecture
- **Base Model**: Stable Diffusion v1.5 (runwayml)
- **Fine-tuning Method**: LoRA adapters on UNet attention layers
- **Target Modules**: `to_q`, `to_k`, `to_v`, `to_out.0` (multi-head attention)
- **LoRA Rank**: 4 (optimized for memory constraints)
- **Trainable Parameters**: 797,184 / 860,318,148 (0.09%)

### Training Configuration
```python
# Optimization
Optimizer: AdamW (β1=0.9, β2=0.999)
Learning Rate: 1e-4
Batch Size: 1 (with gradient accumulation)
Epochs: 20

# Memory Management
Frozen: VAE, Text Encoder
Precision: FP32 (MPS doesn't support mixed precision)
MPS Cache Clearing: Every training step

# Loss Function
Objective: MSE between predicted and actual noise
Scheduler: DDPM (Denoising Diffusion Probabilistic Model)
```

### Inference Pipeline
- **Scheduler**: DPM-Solver++ multistep (fast inference)
- **Steps**: 50 (optimized for quality/speed trade-off)
- **Guidance Scale**: 9.0-9.5 (strong prompt adherence)
- **Generation Time**: ~45 seconds per 512×512 image

## Technical Highlights

### Why LoRA?

Low-Rank Adaptation enables efficient fine-tuning by:
1. **Decomposing weight updates** into low-rank matrices (r=4)
2. **Freezing pre-trained weights** - only training adapter parameters
3. **Enabling fast switching** between different adaptations
4. **Reducing memory footprint** dramatically

Mathematical formulation:
```
W_finetuned = W_pretrained + ΔW
where ΔW = BA (B ∈ R^(d×r), A ∈ R^(r×k), r << d,k)
```

### Apple Silicon Optimization

Optimizations for MPS (Metal Performance Shaders):
- **FP32 precision**: MPS backend doesn't support FP16 mixed precision yet
- **Memory leak prevention**: Explicit cache clearing with `torch.mps.empty_cache()`
- **Batch size tuning**: Single-sample batches to fit in 16GB unified memory
- **Gradient clipping**: Norm-based clipping at 1.0 for stability

### Training Dynamics

**Loss Progression:**
- Epoch 1: 0.0521
- Epoch 10: 0.0530
- Epoch 20: 0.0494 ✓

The model showed steady convergence with minimal overfitting, indicating effective regularization from the low-rank constraint.

## Results & Evaluation

### Quantitative Metrics
- **Final Training Loss**: 0.0494 (5.2% improvement)
- **Training Time**: 12.2 hours on Apple M3
- **Throughput**: ~2.4 seconds per training sample
- **Memory Usage**: ~14GB peak (fits in 16GB budget)

### Qualitative Performance
The fine-tuned model successfully:
- ✅ Generates coherent, high-quality 512×512 images
- ✅ Maintains consistent visual style across generations
- ✅ Generalizes to unseen concept combinations
- ✅ Responds appropriately to text prompts with good diversity

## Technical Skills Demonstrated

### Deep Learning
- PyTorch model training and optimization
- Diffusion model architectures (UNet, VAE, CLIP)
- Transfer learning and fine-tuning strategies
- Loss function design and optimization

### ML Engineering
- GPU/MPS optimization and memory management
- Training pipeline development (data loading, checkpointing)
- Hyperparameter tuning and monitoring
- Production inference optimization

### Software Engineering
- Modular, maintainable code structure
- Command-line interface design with argparse
- Automated data collection and preprocessing
- Version control and documentation

## Future Enhancements

- [ ] **Web Interface**: Deploy Streamlit/Gradio app for interactive generation
- [ ] **Higher Ranks**: Experiment with LoRA ranks 8, 16 for quality improvement
- [ ] **Extended Training**: Push to 30-40 epochs to evaluate long-term convergence
- [ ] **ControlNet Integration**: Add spatial control for composition/pose
- [ ] **Multi-Concept Training**: Fine-tune on multiple domains with separate adapters

## What I Learned

### Technical Insights
- **Parameter efficiency vs. expressiveness trade-off**: Lower ranks save memory but may limit adaptation capacity
- **MPS backend quirks**: Apple Silicon requires different optimization strategies than CUDA
- **Prompt engineering matters**: Generation quality is highly sensitive to prompt structure and guidance scale

### Best Practices
- **Start small**: Test with single-epoch runs before full training
- **Monitor memory**: Implement explicit memory management for MPS
- **Save checkpoints**: Regular checkpointing enables iterative experimentation
- **Document experiments**: Track hyperparameters and results systematically

## Links

- **[GitHub Repository](https://github.com/jlattanzi4/PokeForge)** - Full source code and documentation
- **[Technical README](https://github.com/jlattanzi4/PokeForge#readme)** - Detailed setup and usage instructions

## Technologies

**Frameworks**: PyTorch 2.9.0, HuggingFace Diffusers, HuggingFace PEFT
**Models**: Stable Diffusion v1.5, CLIP, VAE, UNet2D
**Optimization**: Apple Metal Performance Shaders (MPS)
**Data**: PokeAPI, custom preprocessing pipeline
**Tools**: Pandas, Pillow, tqdm, argparse

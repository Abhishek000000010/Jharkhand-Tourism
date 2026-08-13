import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Mountain, Compass, Home as HomeIcon, ShoppingBag, ArrowRight, MapPin, CheckCircle2 } from 'lucide-react';

const Home = () => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, 300]);
  const opacity = useTransform(scrollY, [0, 500], [1, 0]);

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const destinations = [
    { name: 'Netarhat', tag: 'Queen of Chotanagpur', image: '/images/destinations/netarhat.jpg' },
    { name: 'Hundru Falls', tag: 'Natural Wonder', image: '/images/destinations/hundru-falls.jpg' },
    { name: 'Betla National Park', tag: 'Wildlife Safaris', image: '/images/destinations/betla-national-park.jpg' },
    { name: 'Deoghar', tag: 'Spiritual City', image: '/images/destinations/baidyanath-temple.jpg' }
  ];

  return (
    <div className="home-wrapper" style={{ overflowX: 'hidden' }}>
      {/* Immersive Hero Section with Parallax */}
      <section 
        className="relative flex flex-col items-center justify-center text-center px-4"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          color: 'white',
          overflow: 'hidden'
        }}
      >
        {/* Parallax Background */}
        <motion.div 
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: '-20%',
            backgroundImage: 'url("/images/destinations/patratu-valley.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            y: y1,
            zIndex: -2
          }}
        />
        {/* Gradient Overlay */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.4), rgba(15, 23, 42, 0.95))',
          zIndex: -1
        }} />

        <motion.div 
          className="z-10 max-w-5xl w-full"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          style={{ opacity }}
        >

          <motion.h1 variants={fadeIn} className="font-bold mb-6" style={{ fontSize: 'clamp(3rem, 7vw, 6rem)', lineHeight: 1.05, marginBottom: '2rem', color: '#fff', letterSpacing: '-0.03em' }}>
            Discover the Soul of <br/>
            <span style={{ color: '#4ade80' }}>Jharkhand</span>
          </motion.h1>
          
          <motion.p variants={fadeIn} className="text-xl md:text-2xl text-slate-200 mb-10 max-w-2xl mx-auto font-light" style={{ fontSize: '1.3rem', color: '#e2e8f0', marginBottom: '3rem', maxWidth: '700px', margin: '0 auto 3rem', lineHeight: 1.6 }}>
            Verified homestays, expert local guides, and authentic tribal crafts. Book your next adventure directly with the locals.
          </motion.p>
          
          <motion.div variants={fadeIn} className="flex flex-wrap justify-center gap-4" style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
            <Link to="/explore" className="btn btn-primary btn-glow" style={{ padding: '1rem 2.5rem', fontSize: '1.15rem', borderRadius: '50px', fontWeight: 600 }}>
              Start Exploring
            </Link>
            <Link to="/planner" className="btn glass-panel-dark hover-lift" style={{ padding: '1rem 2.5rem', fontSize: '1.15rem', borderRadius: '50px', color: '#fff', textDecoration: 'none', fontWeight: 500, border: '1px solid rgba(255,255,255,0.3)' }}>
              Try AI Planner
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Modern Bento Box Features */}
      <section className="page" style={{ paddingTop: '8rem', paddingBottom: '8rem', position: 'relative' }}>
        {/* Ambient background orbs */}
        <div className="ambient-orb ambient-orb-1"></div>
        <div className="ambient-orb ambient-orb-2"></div>

        <div className="center mb-10" style={{ textAlign: 'center', marginBottom: '4rem', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: '2.8rem', marginBottom: '1rem', letterSpacing: '-0.02em' }}>Experience the Real Jharkhand</h2>
          <p className="muted" style={{ fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>A seamless platform connecting you to the heart of the state.</p>
        </div>
        
        <div className="bento-grid" style={{ position: 'relative', zIndex: 1 }}>
          {/* Large Card: Stay */}
          <motion.div 
            className="bento-card bento-span-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <div>
              <div style={{ background: 'var(--accent-soft)', width: '70px', height: '70px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                <HomeIcon size={36} color="var(--accent)" />
              </div>
              <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Authentic Homestays</h3>
              <p className="muted" style={{ fontSize: '1.15rem', lineHeight: 1.7, maxWidth: '90%' }}>
                Stay on the Netarhat ridge or at the edge of Betla National Park. Every homestay is physically verified by the Department of Tourism for quality and safety.
              </p>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {['Live Availability', 'Instant Booking', 'Verified Hosts'].map(feat => (
                <li key={feat} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, color: 'var(--text)' }}>
                  <CheckCircle2 size={18} color="var(--accent)" /> {feat}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Small Card: Explore */}
          <motion.div 
            className="bento-card bento-span-4"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.15 }}
            style={{ background: 'linear-gradient(135deg, var(--accent), #0f5132)', color: 'white', border: 'none' }}
          >
            <div style={{ background: 'rgba(255,255,255,0.15)', width: '70px', height: '70px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem', backdropFilter: 'blur(10px)' }}>
              <Compass size={36} color="white" />
            </div>
            <h3 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'white' }}>Expert Guides</h3>
            <p style={{ fontSize: '1.1rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>
              Local guides for trekking, birding, and tribal village walks. Book a specialized guide for the day to uncover hidden gems.
            </p>
          </motion.div>

          {/* Small Card: Take Home */}
          <motion.div 
            className="bento-card bento-span-4"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div style={{ background: '#fef3c7', width: '70px', height: '70px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
              <ShoppingBag size={36} color="#d97706" />
            </div>
            <h3 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>Tribal Crafts</h3>
            <p className="muted" style={{ fontSize: '1.1rem', lineHeight: 1.6 }}>
              Buy Sohrai paintings, Dokra metalwork, and bamboo crafts directly from the artisans with zero middlemen.
            </p>
          </motion.div>

          {/* Wide Image Card */}
          <motion.div 
            className="bento-card bento-span-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.45 }}
            style={{ padding: 0, minHeight: '300px', display: 'flex', alignItems: 'flex-end' }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url("/images/destinations/dassam-falls.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', transition: 'transform 0.5s ease' }} className="hover-scale-img"></div>
            <div style={{ position: 'relative', padding: '2.5rem', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', width: '100%', color: 'white' }}>
              <span style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, color: '#4ade80' }}>Breathtaking Nature</span>
              <h3 style={{ fontSize: '2rem', margin: '0.5rem 0', color: 'white' }}>Dassam Falls, Ranchi</h3>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Popular Destinations Showcase */}
      <section style={{ background: '#f8fafc', padding: '8rem 0' }}>
        <div className="page-fluid">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '2.8rem', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Popular Destinations</h2>
              <p className="muted" style={{ fontSize: '1.2rem' }}>Places hand-picked for their natural beauty and culture.</p>
            </div>
            <Link to="/explore" className="btn btn-ghost" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--accent)', fontSize: '1.1rem', fontWeight: 600 }}>
              View all destinations <ArrowRight size={18} />
            </Link>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {destinations.map((dest, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-50px" }}
                whileHover={{ y: -8 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                style={{ 
                  position: 'relative', 
                  borderRadius: '24px', 
                  overflow: 'hidden', 
                  height: '400px',
                  boxShadow: 'var(--shadow-md)',
                  cursor: 'pointer'
                }}
              >
                <img src={dest.image} alt={dest.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1)' }} className="dest-img hover-lift" />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2.5rem 1.5rem', background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4) 60%, transparent)', color: 'white', pointerEvents: 'none' }}>
                  <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, color: '#4ade80' }}>{dest.tag}</span>
                  <h3 style={{ fontSize: '1.8rem', margin: '0.4rem 0', color: 'white' }}>{dest.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', color: '#cbd5e1' }}>
                    <MapPin size={16} /> Jharkhand, India
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Modern CTA Section */}
      <section style={{ padding: '8rem 1.5rem', background: 'var(--bg)' }}>
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          style={{ 
            maxWidth: '1000px', 
            margin: '0 auto', 
            background: 'url("/images/destinations/rajmahal-hills.jpg") center/cover no-repeat',
            borderRadius: '32px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 25px 50px rgba(0,0,0,0.15)'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(21, 128, 61, 0.95), rgba(15, 81, 50, 0.95))' }}></div>
          <div style={{ position: 'relative', padding: '5rem 3rem', textAlign: 'center', color: 'white', zIndex: 1 }}>
            <h2 style={{ fontSize: '3rem', color: 'white', marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Are you a local operator?</h2>
            <p style={{ fontSize: '1.3rem', color: 'rgba(255,255,255,0.9)', marginBottom: '3rem', maxWidth: '700px', margin: '0 auto 3rem', lineHeight: 1.6 }}>
              Join our verified network of homestays, guides, and artisans to offer your services directly to tourists without middlemen.
            </p>
            <Link to="/register" className="btn hover-lift" style={{ background: 'white', color: 'var(--accent)', padding: '1.2rem 3rem', fontSize: '1.15rem', borderRadius: '50px', fontWeight: 600, border: 'none', display: 'inline-block', textDecoration: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
              Join as an Operator
            </Link>
          </div>
        </motion.div>
      </section>
      
      {/* Footer minimal addition */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '1.1rem' }}>© {new Date().getFullYear()} Jharkhand Tourism. Eco & Cultural Platform.</p>
      </footer>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hover-scale-img { width: 100%; height: 100%; }
        .bento-card:hover .hover-scale-img { transform: scale(1.05); }
        .bento-card:hover .dest-img { transform: scale(1.05); }
      `}} />
    </div>
  );
};

export default Home;

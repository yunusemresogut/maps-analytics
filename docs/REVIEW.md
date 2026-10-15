# Proje Geliştirme Görevleri

## Genel Bilgi

* Mevcut projeyi incele ve mevcut mimariyi koruyarak geliştirmeleri yap.
* Mevcut uygulama geçici olarak Supabase kullanır; bugünkü geliştirmelerde mevcut entegrasyon korunur.
* İleride Laravel + PostgreSQL altyapısına geçiş planlanıyor; zamanlama henüz belli değildir.
* Geçiş başlayana kadar backend değişikliği veya Supabase'i kaldırma çalışması yapılmayacaktır.
* Veri erişimi ve iş kuralları mümkün olduğunca modüler tutulmalıdır.

---

# Kimlik Doğrulama

## Login

* Uygulama açıldığında ilk olarak Login ekranı gösterilsin.
* Login ve Register ekranları ayrı sayfalarda yer alacak.
* Giriş ve kayıt akışları ortak, profesyonel iki kolonlu tasarım dilini kullanacak.
* Firma hesabı kayıt formu bulunacak.

## Kullanıcı Tipleri

İki ayrı giriş yapısı olacak:

### Admin Paneli

* Sadece admin kullanıcıları giriş yapabilir.
* Yönetim işlemleri burada yapılır.

### Kullanıcı Paneli

* Normal kullanıcıların kullandığı panel.
* Yetkilerine göre işlem yapabilir.

---

# Proje Durumları

Her proje veya pin için aşağıdaki durumlar desteklenecek:

* Proje
* İhale
* Şantiye
* Açılış
* Hakediş
* Fatura
* Yakında Açılıyor

Not:

* Finans kayıtları ilişkili sözleşme/hakediş/fatura akışında kullanılacaktır.

---

# Tarih Bazlı Uyarılar

## Açılış Tarihi

* Her proje için Açılış Tarihi alanı bulunacak.
* Açılış tarihi geçtiğinde:

  * Kaç gün geçtiği hesaplanacak.
  * Bildirim sistemi için altyapı hazırlanacak.
  * Şimdilik bildirimler pasif olabilir.

## Yakında Açılıyor

* Açılışa 7 gün veya daha az kaldığında proje kırmızı renkle vurgulansın.
* Bildirim sistemi için altyapı hazırlansın.
* Şimdilik demo çalışması yeterlidir.

---

# Dosya Yönetimi

## Dosya Yükleme

Aşağıdaki dosya türleri desteklenecek:

* PDF
* DWG
* XLSX
* CSV
* DOC
* DOCX
* PNG
* JPG
* MP4

Şimdilik gerçek upload yerine mock veri kullanılabilir.

## Excel Import

İhale ve Proje kayıtlarında Excel Import özelliği olacak.

* Excel dosyasından veri aktarımı yapılabilecek.
* İhale modülünde ayrıca kullanıcıya:

  * "Bunu sipariş et" şeklinde bir uyarı mekanizması için altyapı hazırlansın.
* Şimdilik demo çalışması yeterlidir.

---

# Form Alanları

Mevcut forma aşağıdaki alanlar eklensin:

* Kabul Tarihi
* Yüklenici Firma
* Şantiye Şefi

---

# Kayıt Geçmişi (Audit Log)

## Notlar

* Eklenen notlarda:

  * Kim ekledi
  * Ekleme tarihi

bilgileri gösterilsin.

## Pin Bilgileri

Her pin için:

* Oluşturan kişi
* Oluşturulma tarihi
* Son düzenleyen kişi
* Son düzenlenme tarihi

bilgileri tutulacak ve görüntülenecek.

---

# Bölge Yönetimi

## Bölge Oluşturma

Admin;

* Bölge oluşturabilir.
* Bölge düzenleyebilir.
* Bölge silebilir.

Bir bölge;

* Birden fazla şehirden oluşabilir.
* Şehirler ekle/çıkar mantığıyla yönetilebilir.
* Mümkünse sürükle-bırak desteği düşünülebilir.

## Harita Filtreleme

Harita üzerinde:

* Her bölge için ayrı göster/gizle switch'i olsun.
* Tüm bölgeleri göster seçeneği olsun.
* Tüm bölgeleri gizle seçeneği olsun.
* Genel bir "Bölgeleri Göster/Gizle" butonu bulunsun.

---

# Rol ve Yetki Sistemi

Admin panelinde rol bazlı yetkilendirme olacak.

Her kullanıcı için aşağıdaki izinler ayrı ayrı tanımlanabilecek:

* Görüntüleme
* Ekleme
* Düzenleme
* Silme

Her kullanıcı tüm işlemleri yapmak zorunda değildir.

---

# Admin Paneli

* Admin paneline sadece admin hesapları giriş yapabilir.
* Kullanıcı yönetimi burada yapılacaktır.
* Roller ve yetkiler burada yönetilecektir.

---

# Dashboard

İleride kullanılmak üzere analiz ve grafiksel bir dashboard tasarlanacak.

Şimdilik sadece altyapı ve placeholder ekranı oluşturulabilir.

İleride düşünülebilecek örnek metrikler:

* Bölgelere göre proje sayısı
* Durumlara göre dağılım
* Yaklaşan açılışlar
* Geciken açılışlar
* Kullanıcı aktiviteleri
* Son eklenen projeler

---

# Modül Akışları

## Tadilat Talepleri

* Ticket oluşturulurken durum varsayılan olarak Açık olur; oluşturma formunda durum seçilmez.
* Ticket oluşturma sırasında ek dosya seçilebilir.
* Başarılı oluşturma sonrası listeye dönülür; ticket'ın kendi detay sayfasında bilgiler ve ekler görüntülenir.
* Ticket için ayrı bir dashboard ekranı bulunmaz.

## Sözleşme, Hakediş ve Fatura

* Sözleşme kodu düzenlenebilir, ek dosyaları yönetilebilir ve sözleşme feshedilebilir.
* İhale durumundaki mağazada geçerli sözleşme yoksa yetkili kullanıcıya sözleşme oluşturma bağlantısı gösterilir.
* Mağaza Hakediş durumuna geçtiğinde ilişkili sözleşme tamamlanır. Fesih edilmiş sözleşmeler listede kırmızı vurgulanır.
* Sözleşme ödeme ilerlemesi göstermez. Hakediş sözleşmeye, fatura hakedişe bağlanır.
* Hakediş dönemleri başlangıç ve bitiş tarihi ile girilir. İlerleme, ilişkili sözleşme tutarına oranlanan ödenmiş fatura toplamından hesaplanır; alanlar Toplam Hakediş ve Ödenen olarak gösterilir.
* Fatura oluşturma/düzenlemede KDV oranı seçilir ve KDV ile toplam otomatik hesaplanır.

## Profil ve Yetkiler

* Profil fotoğrafı yoksa ad ve soyad baş harfleri gösterilir; fotoğraf kaldırılınca bu görünüm geri gelir.
* Rol görünen adları admin tarafından düzenlenebilir.

## Malzeme, İş Planı ve Para Birimi

* Malzeme ve iş planı her proje durumunda görüntülenip eklenebilir; mevcut rol yazma izinleri korunur.
* Malzeme ve iş planı mağaza detayında tam genişlikli, sayfalı tablo olarak sunulur.
* Malzeme form alanları odaklanınca etiketi yukarı taşır.
* İş planı tabloda veya Gantt görünümünde incelenebilir. Primavera P6 `.xer` aktiviteleri içe aktarılabilir; mevcut model aktivite, tarih ve durumu saklar.
* Kur dönüşümü başlayana kadar parasal değerler tüm arayüzde TRY olarak gösterilir.

---

# Teknik Beklentiler

* Mevcut projeyi analiz ederek geliştirmeleri entegre et.
* Mevcut UI tasarımını bozma.
* Kodları modüler yaz.
* Mevcut Supabase entegrasyonunu koru; bu aşamada backend geçişi yapma.
* Yeni veri erişimi ve iş kurallarını modüler tut.
* İleride Laravel + PostgreSQL'e geçişi kolaylaştıracak sınırlar oluştur; geçiş zamanlaması belli değildir.
